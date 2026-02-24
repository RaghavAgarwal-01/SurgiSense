import { useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000";

export default function RecordDigitization() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    const res = await axios.post(
      `${API_BASE}/api/digitize-record`,
      formData
    );
    setData(res.data.data);
    setLoading(false);
  };

  return (
    <div>
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Digitize</button>

      {loading && <p>Processing PDF...</p>}

      {data && (
        <pre className="text-xs bg-slate-100 p-4 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}