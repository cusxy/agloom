import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

function Hero() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "4rem 2rem",
        textAlign: "center",
      }}
    >
      <h1>{siteConfig.title}</h1>
      <p style={{ fontSize: "1.25rem" }}>{siteConfig.tagline}</p>
      <Link
        className="button button--primary button--lg"
        to="/docs/guide/introduction"
      >
        Get Started
      </Link>
    </header>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <Hero />
    </Layout>
  );
}
