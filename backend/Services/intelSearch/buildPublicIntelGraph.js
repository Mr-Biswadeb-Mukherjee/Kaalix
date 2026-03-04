import { checkIntelInternetConnectivity } from "../intelConnectivity.service.js";
import {
  MAX_DOMAIN_CERT_LOOKUPS,
  MAX_EMAIL_CANDIDATES,
  MAX_GRAVATAR_PROBES,
  MAX_QUERY_LENGTH,
  MAX_WIKIDATA_DETAILS,
} from "./constants.js";
import {
  addEmailNodeToGraph,
  addGravatarNodeToGraph,
  addProfileNodeToGraph,
  addWebsiteNodeToGraph,
  buildSourceStatus,
  createBuildTimeline,
  createGraph,
} from "./graph.js";
import { createHttpError } from "./http.js";
import {
  cleanWhitespace,
  generateEmailCandidates,
  generateUsernameCandidates,
  hashText,
  inferQueryType,
  normalizeDomain,
  normalizeEmail,
  normalizeUsername,
  toSafeIdFragment,
  truncateText,
} from "./normalization.js";
import {
  fetchCertificateSubdomains,
  fetchDomainDnsIntel,
  fetchDomainRdapIntel,
  fetchGravatarByEmail,
  fetchWikidataEntityDetails,
  searchGithubUsers,
  searchWikidataEntities,
  searchWikipedia,
} from "./sources.js";
import { probeUsernameCandidate } from "./usernameProbes.js";

export const buildPublicIntelGraph = async (rawQuery) => {
  const query = cleanWhitespace(rawQuery);
  if (!query) {
    throw createHttpError(400, "Query is required.", "INTEL_QUERY_REQUIRED");
  }
  if (query.length < 2 || query.length > MAX_QUERY_LENGTH) {
    throw createHttpError(
      400,
      `Query must be between 2 and ${MAX_QUERY_LENGTH} characters.`,
      "INTEL_QUERY_INVALID"
    );
  }

  const connectivity = await checkIntelInternetConnectivity();
  if (!connectivity.connected) {
    throw createHttpError(
      503,
      "KaaliX Intelligence cannot access public internet from the backend.",
      "INTEL_CONNECTIVITY_OFFLINE"
    );
  }

  const graph = createGraph();
  const sourceStatus = [];
  const timeline = createBuildTimeline();
  const domains = new Set();
  const discoveredEmails = new Set();
  const queryType = inferQueryType(query);
  const rootId = `target:${query.toLowerCase()}`;
  const startedAt = Date.now();
  const normalizedQueryEmail = normalizeEmail(query);
  const normalizedQueryDomain = normalizeDomain(query);

  graph.addNode({
    id: rootId,
    type: queryType,
    label: query,
    source: "user_input",
    confidence: 1,
    evidence: [
      {
        source: "user_input",
        label: "Query seed",
      },
    ],
  });

  const seedStage = timeline.start("seed_analysis", "Seed Analysis", "Normalize query into known seed types");

  if (normalizedQueryEmail) {
    const emailNodeId = addEmailNodeToGraph(graph, {
      email: normalizedQueryEmail,
      fromId: rootId,
      relation: "input_email",
      source: "user_input",
      confidence: 1,
      description: "Input email seed",
    });
    if (emailNodeId) discoveredEmails.add(normalizedQueryEmail);
    const emailDomain = normalizedQueryEmail.split("@")[1] || "";
    const normalizedEmailDomain = normalizeDomain(emailDomain);
    if (normalizedEmailDomain) {
      domains.add(normalizedEmailDomain);
      graph.addNode({
        id: `domain:${normalizedEmailDomain}`,
        type: "domain",
        label: normalizedEmailDomain,
        source: "user_input",
        url: `https://${normalizedEmailDomain}`,
      });
      graph.addEdge({
        from: emailNodeId || rootId,
        to: `domain:${normalizedEmailDomain}`,
        relation: "email_domain",
        source: "user_input",
        sourceUrl: `mailto:${normalizedQueryEmail}`,
        confidence: 1,
      });
    }
  }

  if (normalizedQueryDomain) {
    domains.add(normalizedQueryDomain);
    graph.addNode({
      id: `domain:${normalizedQueryDomain}`,
      type: "domain",
      label: normalizedQueryDomain,
      source: "user_input",
      url: `https://${normalizedQueryDomain}`,
      evidence: [
        {
          source: "user_input",
          url: `https://${normalizedQueryDomain}`,
          label: "Input domain seed",
        },
      ],
    });
    graph.addEdge({
      from: rootId,
      to: `domain:${normalizedQueryDomain}`,
      relation: "input_domain",
      source: "user_input",
      sourceUrl: `https://${normalizedQueryDomain}`,
      confidence: 1,
    });
  }

  timeline.finish(
    seedStage,
    "ok",
    Number(Boolean(normalizedQueryDomain)) + Number(Boolean(normalizedQueryEmail)),
    queryType === "unknown" ? "Seed type inferred as unknown" : `Seed type: ${queryType}`
  );

  const usernameCandidates = generateUsernameCandidates(query, queryType);
  const usernameStage = timeline.start(
    "username_expansion",
    "Username Expansion",
    "Generate aliases and probe public username identities"
  );
  if (usernameCandidates.length > 0) {
    const probeResults = await Promise.allSettled(
      usernameCandidates.map((candidate) => probeUsernameCandidate(candidate))
    );

    let candidateNodes = 0;
    let profileRecords = 0;
    let emailRecords = 0;
    let websiteRecords = 0;
    let probeFailures = 0;

    for (let i = 0; i < usernameCandidates.length; i += 1) {
      const candidate = usernameCandidates[i];
      const candidateId = `username:${candidate}`;
      candidateNodes += 1;

      graph.addNode({
        id: candidateId,
        type: "username",
        label: `@${candidate}`,
        handle: candidate,
        source: candidate === normalizeUsername(query) ? "user_input" : "heuristic",
        evidence: [
          {
            source: "heuristic",
            label: "Username candidate",
          },
        ],
      });

      graph.addEdge({
        from: rootId,
        to: candidateId,
        relation: "username_candidate",
        source: "heuristic",
        sourceUrl: "",
        confidence: candidate === normalizeUsername(query) ? 0.98 : 0.62,
      });

      const result = probeResults[i];
      if (result.status !== "fulfilled") {
        probeFailures += 1;
        continue;
      }

      probeFailures += result.value.failures;

      for (const profile of result.value.profiles) {
        const added = addProfileNodeToGraph(graph, {
          ...profile,
          fromId: candidateId,
        });
        if (added) profileRecords += 1;
      }

      for (const profile of result.value.relatedProfiles || []) {
        const added = addProfileNodeToGraph(graph, {
          ...profile,
          fromId: candidateId,
        });
        if (added) profileRecords += 1;
      }

      for (const email of result.value.emails || []) {
        const emailNodeId = addEmailNodeToGraph(graph, {
          email,
          fromId: candidateId,
          relation: "related_email",
          source: "identity_probe",
          sourceUrl: "",
          confidence: 0.82,
          description: "Email observed in public profile metadata",
        });
        if (!emailNodeId) continue;
        discoveredEmails.add(email);
        emailRecords += 1;
      }

      for (const website of result.value.websites || []) {
        const websiteNodeId = addWebsiteNodeToGraph(graph, {
          url: website.url,
          fromId: candidateId,
          relation: "related_website",
          source: website.source || "identity_probe",
          sourceUrl: website.url,
          confidence: Number.isFinite(website.confidence) ? website.confidence : 0.75,
          description: "Website linked from public profile metadata",
        });
        if (!websiteNodeId) continue;
        websiteRecords += 1;
        const websiteDomain = normalizeDomain(website.url);
        if (websiteDomain) {
          domains.add(websiteDomain);
          graph.addNode({
            id: `domain:${websiteDomain}`,
            type: "domain",
            label: websiteDomain,
            source: website.source || "identity_probe",
            url: `https://${websiteDomain}`,
          });
          graph.addEdge({
            from: websiteNodeId,
            to: `domain:${websiteDomain}`,
            relation: "website_domain",
            source: website.source || "identity_probe",
            sourceUrl: website.url,
            confidence: 0.78,
          });
        }
      }
    }

    sourceStatus.push(
      buildSourceStatus(
        "username_candidates",
        "Username Candidate Expansion",
        probeFailures > 0 && profileRecords === 0 ? "partial" : "ok",
        candidateNodes,
        "",
        ""
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "username_identity_probes",
        "Username Identity Probes",
        probeFailures > 0 && profileRecords === 0 ? "partial" : "ok",
        profileRecords,
        probeFailures > 0 ? `${probeFailures} probe checks returned no response` : "",
        "https://github.com/"
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "username_email_website",
        "Username Email/Website Links",
        "ok",
        emailRecords + websiteRecords,
        "",
        ""
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "slack",
        "Slack Accounts",
        "skipped",
        0,
        "Slack identities are workspace-scoped and not globally enumerable from public internet."
      )
    );

    timeline.finish(
      usernameStage,
      probeFailures > 0 && profileRecords === 0 ? "partial" : "ok",
      candidateNodes + profileRecords + emailRecords + websiteRecords,
      probeFailures > 0 ? `${probeFailures} probe checks did not return` : ""
    );
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "username_candidates",
        "Username Candidate Expansion",
        "skipped",
        0,
        "No username candidates detected from query"
      )
    );
    sourceStatus.push(
      buildSourceStatus(
        "slack",
        "Slack Accounts",
        "skipped",
        0,
        "Slack identities are workspace-scoped and not globally enumerable from public internet."
      )
    );
    timeline.finish(usernameStage, "skipped", 0, "No username candidates resolved from seed");
  }

  const entityStage = timeline.start(
    "entity_search",
    "Entity Search",
    "Query Wikidata, Wikipedia, and GitHub search index"
  );
  const [wikidataSettled, wikipediaSettled, githubSettled] = await Promise.allSettled([
    searchWikidataEntities(query),
    searchWikipedia(query),
    searchGithubUsers(query),
  ]);
  let entityStageRecords = 0;

  if (wikidataSettled.status === "fulfilled") {
    const entities = wikidataSettled.value.filter((entry) => entry.id && entry.label);
    sourceStatus.push(
      buildSourceStatus(
        "wikidata",
        "Wikidata Entities",
        "ok",
        entities.length,
        "",
        "https://www.wikidata.org/wiki/Wikidata:Main_Page"
      )
    );

    for (const entity of entities) {
      const entityId = `wikidata:${entity.id}`;
      graph.addNode({
        id: entityId,
        type: "entity",
        label: entity.label,
        description: entity.description,
        source: "wikidata",
        url: entity.conceptUri,
        evidence: [
          {
            source: "wikidata",
            url: entity.conceptUri,
            label: "Entity page",
          },
        ],
      });
      graph.addEdge({
        from: rootId,
        to: entityId,
        relation: "matched_entity",
        source: "wikidata",
        sourceUrl: entity.conceptUri,
        confidence: 0.84,
      });
    }

    const detailCandidates = entities.slice(0, MAX_WIKIDATA_DETAILS);
    const detailSettled = await Promise.allSettled(
      detailCandidates.map((entity) => fetchWikidataEntityDetails(entity.id))
    );

    let detailRecords = 0;
    let detailErrors = 0;

    for (let i = 0; i < detailSettled.length; i += 1) {
      const current = detailSettled[i];
      const entity = detailCandidates[i];
      if (current.status !== "fulfilled") {
        detailErrors += 1;
        continue;
      }

      const entityNodeId = `wikidata:${entity.id}`;
      const { websites, profiles } = current.value;

      for (const website of websites) {
        detailRecords += 1;
        domains.add(website.domain);
        const domainNodeId = `domain:${website.domain}`;
        graph.addNode({
          id: domainNodeId,
          type: "domain",
          label: website.domain,
          source: "wikidata",
          url: website.url,
          evidence: [
            {
              source: "wikidata",
              url: website.url,
              label: "Wikidata website claim",
            },
          ],
        });
        graph.addEdge({
          from: entityNodeId,
          to: domainNodeId,
          relation: "official_website",
          source: "wikidata",
          sourceUrl: website.url,
          confidence: 0.93,
        });
      }

      for (const profile of profiles) {
        const added = addProfileNodeToGraph(graph, {
          ...profile,
          fromId: entityNodeId,
          source: "wikidata",
          sourceUrl: `https://www.wikidata.org/wiki/${entity.id}`,
          confidence: 0.88,
        });
        if (added) detailRecords += 1;
      }
    }

    const detailStatus = detailErrors === 0 ? "ok" : detailRecords > 0 ? "partial" : "failed";
    const detailErrorMessage = detailErrors > 0 ? `${detailErrors} detail lookups failed` : "";

    sourceStatus.push(
      buildSourceStatus(
        "wikidata_details",
        "Wikidata Entity Details",
        detailStatus,
        detailRecords,
        detailErrorMessage,
        "https://www.wikidata.org/wiki/Wikidata:Data_access"
      )
    );
    entityStageRecords += entities.length + detailRecords;
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "wikidata",
        "Wikidata Entities",
        "failed",
        0,
        wikidataSettled.reason?.message || "Wikidata search failed",
        "https://www.wikidata.org/wiki/Wikidata:Data_access"
      )
    );
  }

  if (wikipediaSettled.status === "fulfilled") {
    const references = wikipediaSettled.value.filter((entry) => entry.pageId && entry.title);
    sourceStatus.push(
      buildSourceStatus(
        "wikipedia",
        "Wikipedia",
        "ok",
        references.length,
        "",
        "https://www.wikipedia.org/"
      )
    );

    for (const reference of references) {
      const articleNodeId = `wikipedia:${reference.pageId}`;
      const articleUrl = `https://en.wikipedia.org/?curid=${reference.pageId}`;
      graph.addNode({
        id: articleNodeId,
        type: "knowledge_article",
        label: reference.title,
        description: reference.snippet,
        source: "wikipedia",
        url: articleUrl,
        evidence: [
          {
            source: "wikipedia",
            url: articleUrl,
            label: "Wikipedia article",
          },
        ],
      });
      graph.addEdge({
        from: rootId,
        to: articleNodeId,
        relation: "knowledge_reference",
        source: "wikipedia",
        sourceUrl: articleUrl,
        confidence: 0.72,
      });
    }
    entityStageRecords += references.length;
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "wikipedia",
        "Wikipedia",
        "failed",
        0,
        wikipediaSettled.reason?.message || "Wikipedia search failed",
        "https://www.wikipedia.org/"
      )
    );
  }

  if (githubSettled.status === "fulfilled") {
    const profiles = githubSettled.value.filter((entry) => entry.login);
    sourceStatus.push(
      buildSourceStatus(
        "github",
        "GitHub Profiles",
        "ok",
        profiles.length,
        "",
        "https://docs.github.com/en/rest/search"
      )
    );

    for (const profile of profiles) {
      const added = addProfileNodeToGraph(graph, {
        fromId: rootId,
        platform: "github",
        relation: "public_code_identity",
        handle: profile.login,
        url: profile.profileUrl,
        source: "github_search",
        sourceUrl: profile.profileUrl,
        confidence: Math.max(0.45, Math.min(0.85, profile.score / 100)),
        description: profile.type ? `Account type: ${profile.type}` : "",
      });
      if (!added) continue;
    }
    entityStageRecords += profiles.length;
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "github",
        "GitHub Profiles",
        "failed",
        0,
        githubSettled.reason?.message || "GitHub search failed",
        "https://docs.github.com/en/rest/search"
      )
    );
  }
  timeline.finish(entityStage, "ok", entityStageRecords, "Entity correlation completed");

  const domainCandidates = Array.from(domains).slice(0, MAX_DOMAIN_CERT_LOOKUPS);
  const domainStage = timeline.start(
    "domain_intel",
    "Domain Infrastructure Intel",
    "Expand domain seed into DNS, RDAP, and certificate graph"
  );

  if (domainCandidates.length > 0) {
    let crtRecords = 0;
    let dnsRecords = 0;
    let rdapRecords = 0;
    let crtErrors = 0;
    let dnsErrors = 0;
    let rdapErrors = 0;

    const domainIntelSettled = await Promise.allSettled(
      domainCandidates.map(async (domain) => {
        const [crtSubdomains, dnsIntel, rdapIntel] = await Promise.all([
          fetchCertificateSubdomains(domain),
          fetchDomainDnsIntel(domain),
          fetchDomainRdapIntel(domain),
        ]);
        return { domain, crtSubdomains, dnsIntel, rdapIntel };
      })
    );

    for (const domainResult of domainIntelSettled) {
      if (domainResult.status !== "fulfilled") {
        crtErrors += 1;
        dnsErrors += 1;
        rdapErrors += 1;
        continue;
      }

      const { domain, crtSubdomains, dnsIntel, rdapIntel } = domainResult.value;
      const domainNodeId = `domain:${domain}`;

      if (Array.isArray(crtSubdomains)) {
        for (const subdomain of crtSubdomains) {
          if (!subdomain || subdomain === domain) continue;
          crtRecords += 1;
          const subdomainNodeId = `subdomain:${subdomain}`;
          graph.addNode({
            id: subdomainNodeId,
            type: "subdomain",
            label: subdomain,
            source: "crtsh",
            url: `https://${subdomain}`,
            evidence: [
              {
                source: "crtsh",
                url: `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}`,
                label: "crt.sh certificate records",
              },
            ],
          });
          graph.addEdge({
            from: domainNodeId,
            to: subdomainNodeId,
            relation: "certificate_observed",
            source: "crtsh",
            sourceUrl: `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}`,
            confidence: 0.74,
          });
        }
      } else {
        crtErrors += 1;
      }

      if (dnsIntel?.records) {
        dnsErrors += Number(dnsIntel?.failures || 0);

        for (const ip of dnsIntel.records.A || []) {
          dnsRecords += 1;
          const ipNodeId = `ip:${ip}`;
          graph.addNode({
            id: ipNodeId,
            type: "ip",
            label: ip,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: ipNodeId,
            relation: "dns_a_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
            confidence: 0.91,
          });
        }

        for (const ipv6 of dnsIntel.records.AAAA || []) {
          dnsRecords += 1;
          const ipNodeId = `ip:${ipv6}`;
          graph.addNode({
            id: ipNodeId,
            type: "ip",
            label: ipv6,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: ipNodeId,
            relation: "dns_aaaa_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=AAAA`,
            confidence: 0.9,
          });
        }

        for (const mxHost of dnsIntel.records.MX || []) {
          dnsRecords += 1;
          const mxNodeId = `mx:${toSafeIdFragment(mxHost)}`;
          graph.addNode({
            id: mxNodeId,
            type: "mx_host",
            label: mxHost,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: mxNodeId,
            relation: "dns_mx_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
            confidence: 0.9,
          });
        }

        for (const nsHost of dnsIntel.records.NS || []) {
          dnsRecords += 1;
          const nsNodeId = `nameserver:${toSafeIdFragment(nsHost)}`;
          graph.addNode({
            id: nsNodeId,
            type: "nameserver",
            label: nsHost,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: nsNodeId,
            relation: "dns_ns_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=NS`,
            confidence: 0.9,
          });
        }

        for (const txt of dnsIntel.records.TXT || []) {
          dnsRecords += 1;
          const txtNodeId = `txt:${domain}:${hashText(txt)}`;
          graph.addNode({
            id: txtNodeId,
            type: "dns_txt",
            label: truncateText(txt, 96),
            description: txt,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: txtNodeId,
            relation: "dns_txt_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`,
            confidence: 0.88,
          });
        }
      } else {
        dnsErrors += 1;
      }

      if (rdapIntel) {
        if (rdapIntel.registrarName) {
          rdapRecords += 1;
          const registrarId = `registrar:${toSafeIdFragment(rdapIntel.registrarName)}`;
          graph.addNode({
            id: registrarId,
            type: "registrar",
            label: rdapIntel.registrarName,
            source: "rdap",
          });
          graph.addEdge({
            from: domainNodeId,
            to: registrarId,
            relation: "domain_registrar",
            source: "rdap",
            sourceUrl: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
            confidence: 0.93,
          });
        }

        for (const nsHost of rdapIntel.nameservers || []) {
          rdapRecords += 1;
          const nsNodeId = `nameserver:${toSafeIdFragment(nsHost)}`;
          graph.addNode({
            id: nsNodeId,
            type: "nameserver",
            label: nsHost,
            source: "rdap",
          });
          graph.addEdge({
            from: domainNodeId,
            to: nsNodeId,
            relation: "rdap_nameserver",
            source: "rdap",
            sourceUrl: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
            confidence: 0.92,
          });
        }

        for (const status of rdapIntel.statuses || []) {
          rdapRecords += 1;
          const statusNodeId = `rdap-status:${toSafeIdFragment(status)}`;
          graph.addNode({
            id: statusNodeId,
            type: "rdap_status",
            label: status,
            source: "rdap",
          });
          graph.addEdge({
            from: domainNodeId,
            to: statusNodeId,
            relation: "rdap_status",
            source: "rdap",
            sourceUrl: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
            confidence: 0.87,
          });
        }
      } else {
        rdapErrors += 1;
      }
    }

    sourceStatus.push(
      buildSourceStatus(
        "crtsh",
        "Certificate Transparency",
        crtErrors > 0 && crtRecords === 0 ? "partial" : "ok",
        crtRecords,
        crtErrors > 0 ? `${crtErrors} domain lookups returned no certificate data` : "",
        "https://crt.sh/"
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "dns_google",
        "DNS Intelligence",
        dnsErrors > 0 && dnsRecords === 0 ? "partial" : "ok",
        dnsRecords,
        dnsErrors > 0 ? `${dnsErrors} DNS record queries returned no response` : "",
        "https://dns.google/"
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "rdap",
        "RDAP Registration",
        rdapErrors > 0 && rdapRecords === 0 ? "partial" : "ok",
        rdapRecords,
        rdapErrors > 0 ? `${rdapErrors} RDAP lookups returned no response` : "",
        "https://rdap.org/"
      )
    );
    timeline.finish(
      domainStage,
      "ok",
      crtRecords + dnsRecords + rdapRecords,
      `Expanded ${domainCandidates.length} domain seeds`
    );
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "crtsh",
        "Certificate Transparency",
        "skipped",
        0,
        "No domain candidates resolved from input or related entities",
        "https://crt.sh/"
      )
    );
    sourceStatus.push(
      buildSourceStatus(
        "dns_google",
        "DNS Intelligence",
        "skipped",
        0,
        "No domain candidates available for DNS graph expansion",
        "https://dns.google/"
      )
    );
    sourceStatus.push(
      buildSourceStatus(
        "rdap",
        "RDAP Registration",
        "skipped",
        0,
        "No domain candidates available for RDAP expansion",
        "https://rdap.org/"
      )
    );
    timeline.finish(domainStage, "skipped", 0, "No domain candidates to expand");
  }

  const emailStage = timeline.start(
    "email_gravatar",
    "Email + Gravatar Expansion",
    "Derive email graph and probe Gravatar identity profiles"
  );

  const inferredEmailCandidates = generateEmailCandidates(
    query,
    queryType,
    usernameCandidates,
    Array.from(domains)
  );
  const candidateEmails = Array.from(
    new Set([...Array.from(discoveredEmails), ...inferredEmailCandidates])
  ).slice(0, MAX_EMAIL_CANDIDATES);
  let emailCandidateRecords = 0;
  let gravatarRecords = 0;
  let gravatarFailures = 0;

  for (const email of candidateEmails) {
    const emailNodeId = addEmailNodeToGraph(graph, {
      email,
      fromId: rootId,
      relation: queryType === "email" && email === normalizedQueryEmail ? "input_email" : "email_candidate",
      source: email === normalizedQueryEmail ? "user_input" : "email_inference",
      sourceUrl: "",
      confidence: email === normalizedQueryEmail ? 1 : 0.45,
      description:
        email === normalizedQueryEmail
          ? "Input email seed"
          : "Inferred email alias from username/domain expansion",
    });
    if (!emailNodeId) continue;
    discoveredEmails.add(email);
    emailCandidateRecords += 1;
  }

  const gravatarProbeEmails = Array.from(discoveredEmails).slice(0, MAX_GRAVATAR_PROBES);
  const gravatarSettled = await Promise.allSettled(
    gravatarProbeEmails.map((email) => fetchGravatarByEmail(email))
  );

  for (let i = 0; i < gravatarSettled.length; i += 1) {
    const result = gravatarSettled[i];
    if (result.status !== "fulfilled") {
      gravatarFailures += 1;
      continue;
    }
    if (!result.value) continue;

    const emailNodeId = `email:${result.value.email}`;
    const gravatarNodeId = addGravatarNodeToGraph(graph, {
      ...result.value,
      fromId: emailNodeId,
      source: "gravatar",
      confidence: 0.91,
    });
    if (!gravatarNodeId) continue;
    gravatarRecords += 1;

    for (const websiteUrl of result.value.relatedUrls || []) {
      const websiteNodeId = addWebsiteNodeToGraph(graph, {
        url: websiteUrl,
        fromId: gravatarNodeId,
        relation: "gravatar_website",
        source: "gravatar",
        sourceUrl: result.value.sourceUrl,
        confidence: 0.83,
        description: "Website linked from Gravatar profile",
      });
      if (!websiteNodeId) continue;
      const domain = normalizeDomain(websiteUrl);
      if (domain) domains.add(domain);
    }
  }

  sourceStatus.push(
    buildSourceStatus(
      "email_expansion",
      "Email Candidate Expansion",
      candidateEmails.length > 0 ? "ok" : "skipped",
      emailCandidateRecords,
      candidateEmails.length > 0 ? "" : "No email seed could be inferred from the current query"
    )
  );
  sourceStatus.push(
    buildSourceStatus(
      "gravatar",
      "Gravatar Profiles",
      gravatarFailures > 0 && gravatarRecords === 0 ? "partial" : "ok",
      gravatarRecords,
      gravatarFailures > 0 ? `${gravatarFailures} gravatar lookups timed out or failed` : "",
      "https://gravatar.com/"
    )
  );

  timeline.finish(
    emailStage,
    candidateEmails.length > 0 ? "ok" : "skipped",
    emailCandidateRecords + gravatarRecords,
    candidateEmails.length > 0
      ? `Expanded ${candidateEmails.length} email candidates`
      : "No email candidate available for gravatar expansion"
  );

  const graphData = graph.toJson();

  if (graphData.edges.length === 0 && usernameCandidates.length > 0) {
    const fallbackHandle = usernameCandidates[0];
    const fallbackNodeId = `username:${fallbackHandle}`;
    graph.addNode({
      id: fallbackNodeId,
      type: "username",
      label: `@${fallbackHandle}`,
      handle: fallbackHandle,
      source: "heuristic",
      evidence: [
        {
          source: "heuristic",
          label: "Fallback username candidate",
        },
      ],
    });
    graph.addEdge({
      from: rootId,
      to: fallbackNodeId,
      relation: "username_candidate",
      source: "heuristic",
      confidence: 0.58,
    });
  }

  const finalGraph = graph.toJson();
  const profileCount = finalGraph.nodes.filter((node) => node.type === "profile").length;
  const domainCount = finalGraph.nodes.filter((node) =>
    ["domain", "subdomain", "website"].includes(node.type)
  ).length;
  const emailCount = finalGraph.nodes.filter((node) => node.type === "email").length;
  const gravatarCount = finalGraph.nodes.filter((node) => node.type === "gravatar").length;
  const healthySources = sourceStatus.filter((entry) => entry.status === "ok").length;

  return {
    query,
    queryType,
    generatedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Date.now() - startedAt),
    connectivity,
    graph: finalGraph,
    sources: sourceStatus,
    timeline: timeline.toJson(),
    summary: {
      nodes: finalGraph.nodes.length,
      edges: finalGraph.edges.length,
      profiles: profileCount,
      emails: emailCount,
      gravatarProfiles: gravatarCount,
      digitalFootprint: domainCount,
      sourceHealth: `${healthySources}/${sourceStatus.length}`,
    },
  };
};

export default buildPublicIntelGraph;
