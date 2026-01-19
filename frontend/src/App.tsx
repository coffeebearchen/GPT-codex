import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";

function App() {
  const [health, setHealth] = useState("checking");

  useEffect(() => {
    fetch(`${apiBase}/health`)
      .then((res) => res.json())
      .then((data) => setHealth(data.status || "unknown"))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>WeChat Content OS V1</h1>
      <p>Backend health: {health}</p>
      <p>
        This is the minimal UI shell. Use the API endpoints to manage sources,
        documents, runs, and jobs.
      </p>
    </div>
  );
}

export default App;
