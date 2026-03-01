// backend/Database/init.loader.js
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { LoggerContainer } from "../Logger/Logger.js";
import {
  isPersonalEmail,
  isStrictBusinessEmailModeEnabled,
} from "../Utils/emailPolicy.utils.js";
import {
  writeBootstrapCredentialsFile,
  getBootstrapCredentialsFilePath,
  isBootstrapSealed,
  isBootstrapReseedForced,
  markBootstrapSealed,
} from "../Utils/bootstrapCredentials.utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = LoggerContainer.get("Schemas");
const MACHINE_ID_PATHS = ["/etc/machine-id", "/var/lib/dbus/machine-id"];
const SA_MACHINE_SECRET_NAMESPACE = "kaalix-sa-bootstrap-v1";
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]{2,31})$/;
const SOURCE_KEYWORD = "source";

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const replaceWhitespaceWithUnderscore = (value = "") => {
  let output = "";
  let previousWasWhitespace = false;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const code = value.charCodeAt(i);
    const isWhitespace =
      code === 9 ||
      code === 10 ||
      code === 11 ||
      code === 12 ||
      code === 13 ||
      code === 32;

    if (!isWhitespace) {
      output += ch;
      previousWasWhitespace = false;
      continue;
    }

    if (!previousWasWhitespace) {
      output += "_";
      previousWasWhitespace = true;
    }
  }

  return output;
};

const parseSourceRefs = (sqlText = "") => {
  const refs = [];
  const lines = String(sqlText || "").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const lineWithoutCarriage =
      rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const line = lineWithoutCarriage.trim();
    if (!line) continue;
    if (line.startsWith("--") || line.startsWith("#")) continue;

    const lowerLine = line.toLowerCase();
    if (!lowerLine.startsWith(SOURCE_KEYWORD)) continue;

    const afterKeyword = line.slice(SOURCE_KEYWORD.length).trimStart();
    if (!afterKeyword) continue;

    const semicolonIndex = afterKeyword.indexOf(";");
    if (semicolonIndex <= 0) continue;

    const fileRef = afterKeyword.slice(0, semicolonIndex).trim();
    if (fileRef) refs.push(path.basename(fileRef));
  }

  return refs;
};

const getMachineFingerprint = () => {
  for (const machineIdPath of MACHINE_ID_PATHS) {
    try {
      const machineId = fs.readFileSync(machineIdPath, "utf8").trim();
      if (machineId) return machineId;
    } catch {
      // ignore and try next machine id source
    }
  }

  return [os.hostname(), os.platform(), os.arch()].join("|").toLowerCase();
};

const buildMachineBoundSaDefaults = () => {
  const machineDigest = sha256(
    `${SA_MACHINE_SECRET_NAMESPACE}:${getMachineFingerprint()}`
  );

  return {
    email: `sa.${machineDigest.slice(0, 12)}@kaalix.local`,
    password: `Kaalix!${machineDigest.slice(12, 18)}-${machineDigest.slice(18, 24)}#${machineDigest.slice(24, 30)}`,
  };
};

const resolveDefaultSaCredentials = () => {
  const machineDefaults = buildMachineBoundSaDefaults();
  let resolvedEmail = String(process.env.DEFAULT_SA_EMAIL || "")
    .trim()
    .toLowerCase();
  let resolvedPassword = String(process.env.DEFAULT_SA_PASSWORD || "");
  let emailSource = process.env.DEFAULT_SA_EMAIL
    ? "DEFAULT_SA_EMAIL"
    : "machine-generated";
  let passwordSource = process.env.DEFAULT_SA_PASSWORD
    ? "DEFAULT_SA_PASSWORD"
    : "machine-generated";

  if (!resolvedEmail) {
    resolvedEmail = machineDefaults.email;
  }
  if (!resolvedPassword) {
    resolvedPassword = machineDefaults.password;
  }

  if (isStrictBusinessEmailModeEnabled() && isPersonalEmail(resolvedEmail)) {
    logger.warn(
      `⚠️ DEFAULT_SA_EMAIL '${resolvedEmail}' is blocked by strict business-email policy. Falling back to machine-generated SA email.`
    );
    resolvedEmail = machineDefaults.email;
    emailSource = "machine-generated";
  }

  return {
    email: resolvedEmail,
    password: resolvedPassword,
    emailSource,
    passwordSource,
  };
};

const resolveDefaultSaLoginUsername = () => {
  const candidate = String(process.env.DEFAULT_SA_LOGIN || "kaalix-sa")
    .trim()
    .toLowerCase();
  const sanitized = replaceWhitespaceWithUnderscore(candidate);
  if (USERNAME_REGEX.test(sanitized)) {
    return sanitized;
  }
  return "kaalix-sa";
};

const resolveOnboardingState = (state = {}) => {
  const mustChangePassword = Boolean(state.must_change_password);
  const mustUpdateProfile = !state.profile_id;
  const hasPreciseLocation =
    state.location_lat !== null &&
    typeof state.location_lat !== "undefined" &&
    state.location_lng !== null &&
    typeof state.location_lng !== "undefined";
  const mustShareLocation =
    Number(state.location_consent) !== 1 || !hasPreciseLocation;
  return {
    mustChangePassword,
    mustUpdateProfile,
    mustShareLocation,
    required: mustChangePassword || mustUpdateProfile || mustShareLocation,
  };
};


/**
 * Initialize the database by executing all SQL files in order.
 * Tracks execution and re-applies files if they change.
 *
 * @param {import('mysql2/promise').Pool} pool - The MySQL connection pool
 */
export async function initializeDatabase(pool) {
  logger.info("🧩 Database initialization started...");

  // Path to the Schemas folder
  const dbDir = path.join(__dirname, "Schemas");

  // Get all .sql files in the folder
  const files = fs.readdirSync(dbDir).filter(f => f.toLowerCase().endsWith(".sql"));
  const orderedFiles = getExecutionOrder(files, dbDir);

  for (const file of orderedFiles) {
    const filePath = path.join(dbDir, file);
    const sql = fs.readFileSync(filePath, "utf8").trim();
    if (!sql) continue;

    // Compute SHA-256 hash of the file
    const hash = crypto.createHash("sha256").update(sql).digest("hex");

    // Check if file has been executed before
    let existing;
    try {
      [existing] = await pool.query(
        "SELECT hash FROM _init_history WHERE filename = ?",
        [file]
      );
    } catch {
      // Skip if _init_history doesn't exist yet (db_history.sql will create it)
      existing = [];
    }

    if (existing.length > 0) {
      if (existing[0].hash === hash) {
        logger.verbose(`⚙️  Skipping ${file} (unchanged)`);
        continue;
      } else {
        logger.warn(`🔄 Re-applying ${file} (file changed)`);
        try {
          await pool.query(sql);
          await pool.query(
            "UPDATE _init_history SET hash = ?, executed_at = CURRENT_TIMESTAMP WHERE filename = ?",
            [hash, file]
          );
        } catch (err) {
          logger.error(`❌ Error executing ${file}: ${err.message}`);
          process.exit(1);
        }
        continue;
      }
    }

    // First-time execution
    try { 
      logger.info(`📦 Executing ${file}...`);
      await pool.query(sql);
      await pool.query(
        "INSERT INTO _init_history (filename, hash) VALUES (?, ?)",
        [file, hash]
      );
    } catch (err) {
      logger.error(`❌ Error executing ${file}: ${err.message}`);
      process.exit(1);
    }
  }

  logger.info("✅ Database initialization complete.");
}

/**
 * Seed a default SA user on first app startup.
 * If an SA user already exists, this is a no-op.
 */
export async function ensureDefaultSaAccount(pool) {
  const defaultDisplayName =
    (process.env.DEFAULT_SA_USERNAME || "Kaalix Super Admin").trim();
  const defaultLoginUsername = resolveDefaultSaLoginUsername();
  const {
    email: defaultEmail,
    password: defaultPassword,
    emailSource,
    passwordSource,
  } = resolveDefaultSaCredentials();

  if (!defaultEmail || !defaultPassword) {
    logger.warn("⚠️ Skipping SA seed: unable to resolve SA credentials.");
    return;
  }

  const [requiredTables] = await pool.query(
    `SELECT table_name
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND table_name IN ('users', 'profiles')`
  );

  if (!requiredTables || requiredTables.length < 2) {
    logger.warn("⚠️ Skipping SA seed: users/profiles tables are not ready.");
    return;
  }

  const [roleColumn] = await pool.query(
    `SELECT column_name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND table_name = 'users'
       AND column_name = 'role'
     LIMIT 1`
  );

  if (!roleColumn || roleColumn.length === 0) {
    logger.warn("⚠️ Skipping SA seed: users.role column not found.");
    return;
  }

  const bootstrapSealed = isBootstrapSealed();
  const forceBootstrapReseed = isBootstrapReseedForced();

  if (bootstrapSealed && forceBootstrapReseed) {
    logger.warn(
      "⚠️ SA bootstrap seal bypassed because SA_BOOTSTRAP_FORCE_RESEED is enabled."
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [saRows] = await conn.execute(
      "SELECT user_id, username, email, must_change_password FROM users WHERE role = 'sa' LIMIT 1 FOR UPDATE"
    );

    if (saRows.length > 0) {
      const saIdentity = saRows[0];
      const saUserId = saIdentity.user_id;
      let shouldSealBootstrap = false;
      const [profileRows] = await conn.execute(
        `SELECT profile_id, location_consent, location_lat, location_lng
         FROM profiles
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [saUserId]
      );

      if (profileRows.length === 0) {
        await conn.execute(
          "INSERT INTO profiles (user_id, profile_id, fullName) VALUES (?, ?, ?)",
          [saUserId, null, defaultDisplayName]
        );
        logger.warn(`⚠️ SA profile was missing and has been restored for ${saUserId}.`);
      }

      const latestProfile = profileRows[0] || {
        profile_id: null,
        location_consent: null,
        location_lat: null,
        location_lng: null,
      };
      const onboarding = resolveOnboardingState({
        must_change_password: saIdentity.must_change_password,
        profile_id: latestProfile.profile_id,
        location_consent: latestProfile.location_consent,
        location_lat: latestProfile.location_lat,
        location_lng: latestProfile.location_lng,
      });

      if (!onboarding.required) {
        shouldSealBootstrap = true;
      }

      const bootstrapFilePath = getBootstrapCredentialsFilePath();
      const bootstrapFileExists = fs.existsSync(bootstrapFilePath);
      const canRecoverBootstrapCredentials =
        onboarding.mustChangePassword && (!bootstrapSealed || forceBootstrapReseed);

      if (canRecoverBootstrapCredentials && (!bootstrapFileExists || forceBootstrapReseed)) {
        const bootstrapFilePathEmitted = writeBootstrapCredentialsFile({
          userId: saUserId,
          username: saIdentity.username || defaultLoginUsername,
          email: String(saIdentity.email || defaultEmail).trim().toLowerCase(),
          password: defaultPassword,
        });
        if (bootstrapFilePathEmitted) {
          logger.info(`📁 Bootstrap credential path emitted: ${bootstrapFilePathEmitted}`);
        }
      }

      await conn.commit();
      if (shouldSealBootstrap) {
        markBootstrapSealed({ reason: "existing-sa-onboarding-complete" });
      }
      logger.info("⚙️ Default SA seed skipped: existing SA found.");
      return;
    }

    if (bootstrapSealed && !forceBootstrapReseed) {
      await conn.commit();
      logger.warn(
        "🔒 Skipping SA seed: onboarding was already completed and bootstrap is sealed."
      );
      return;
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const userId = `KAALIX-SA-${uuidv4().replace(/-/g, "").slice(0, 10)}`;

    await conn.execute(
      "INSERT INTO users (user_id, username, email, password, role, must_change_password) VALUES (?, ?, ?, ?, 'sa', 1)",
      [userId, defaultLoginUsername, defaultEmail, hashedPassword]
    );

    await conn.execute(
      "INSERT INTO profiles (user_id, profile_id, fullName) VALUES (?, ?, ?)",
      [userId, null, defaultDisplayName]
    );

    await conn.commit();
    logger.warn(
      `🔐 Default SA user created (username: ${defaultLoginUsername}, email: ${defaultEmail}, role: sa, emailSource: ${emailSource}, passwordSource: ${passwordSource}). Rotate this password immediately.`
    );
    const bootstrapFilePath = writeBootstrapCredentialsFile({
      userId,
      username: defaultLoginUsername,
      email: defaultEmail,
      password: defaultPassword,
    });
    if (bootstrapFilePath) {
      logger.info(`📁 Bootstrap credential path emitted: ${bootstrapFilePath}`);
    }
  } catch (err) {
    await conn.rollback();

    if (
      err?.message?.includes("Only one sa is allowed") ||
      err?.message?.includes("ux_single_super_admin")
    ) {
      logger.warn("⚠️ SA seed skipped: an SA user already exists.");
      return;
    }

    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Determine the execution order of SQL files.
 * Respects SOURCE commands in init.sql if present.
 *
 * @param {string[]} files - List of .sql files
 * @param {string} dbDir - Path to the Schemas directory
 * @returns {string[]} Ordered list of files to execute
 */
function getExecutionOrder(files, dbDir) {
  const initFile = "init.sql";
  let ordered;

  if (files.includes(initFile)) {
    const initContent = fs.readFileSync(path.join(dbDir, initFile), "utf8");
    const sources = parseSourceRefs(initContent);

    // Execute files referenced in init.sql first
    ordered = [
      ...sources.filter(f => files.includes(f)),
      // Remaining files alphabetically (excluding init.sql and sources)
      ...files.filter(f => f !== initFile && !sources.includes(f)).sort(),
    ];
  } else {
    ordered = files.sort(); // default alphabetical order
  }

  return ordered;
}
