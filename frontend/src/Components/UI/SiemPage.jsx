import "./Styles/SiemPage.css";

const SiemPage = ({
  title,
  description,
  cards = [],
  listTitle = "",
  listItems = [],
}) => {
  return (
    <section className="siem-page">
      <header className="siem-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      {cards.length > 0 && (
        <div className="siem-grid">
          {cards.map((item) => (
            <article className="siem-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
      )}

      {listItems.length > 0 && (
        <article className="siem-card">
          <h3>{listTitle}</h3>
          <ul className="siem-list">
            {listItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
};

export default SiemPage;
