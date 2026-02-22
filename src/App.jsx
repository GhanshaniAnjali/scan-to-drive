import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { CONFIG } from "./config";
import "./styles.css";

function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [generatedFileName, setGeneratedFileName] = useState("");
  const [images, setImages] = useState([]);
  const [docName, setDocName] = useState("");
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);

  // Google OAuth Setup
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google) {
        clearInterval(interval);

        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.GOOGLE_CLIENT_ID,
          scope: "https://www.googleapis.com/auth/drive.file",
          callback: (tokenResponse) => {
            setAccessToken(tokenResponse.access_token);
          },
        });

        window.login = () => {
          tokenClient.requestAccessToken();
        };
      }
    }, 500);
  }, []);

  function handleScan(e) {
    const files = Array.from(e.target.files);
    setImages((prev) => [...prev, ...files]);
    setQr(null);
  }

  async function generatePDF() {
    if (!images.length || !accessToken) {
      alert("Login and scan pages first");
      return;
    }

    if (!docName.trim()) {
      alert("Please enter document name");
      return;
    }

    setLoading(true);

    const pdf = new jsPDF();

    for (let i = 0; i < images.length; i++) {
      const imgData = await fileToBase64(images[i]);

      if (i !== 0) pdf.addPage();

      pdf.addImage(imgData, "JPEG", 10, 10, 190, 270);
    }

    const pdfBlob = pdf.output("blob");

    await uploadToDrive(pdfBlob);

    setLoading(false);
  }

  async function getOrCreateFolder() {
  // Search for existing folder
  const searchRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name='RSSB_Digital_QR_Vault' and mimeType='application/vnd.google-apps.folder'",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder if not exists
  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "RSSB_Digital_QR_Vault",
        mimeType: "application/vnd.google-apps.folder",
      }),
    }
  );

  const folder = await createRes.json();
  return folder.id;
}
  async function uploadToDrive(pdfBlob) {
    const folderId = await getOrCreateFolder();
    const metadata = {
      name: `${docName}.pdf`,
      mimeType: "application/pdf",
      parents: [folderId],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", pdfBlob);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );

    const uploaded = await uploadRes.json();

    await fetch(
      `https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      }
    );

    // This opens in browser viewer (NOT forced download)
    const link = `https://drive.google.com/file/d/${uploaded.id}/preview`;

    setGeneratedFileName(`${docName}.pdf`);
    const qrData = await QRCode.toDataURL(link);
    
    setQr(qrData);
    

    // Reset after success
    setImages([]);
    setDocName("");
  }

  function saveQR() {
  const link = document.createElement("a");
  link.href = qr;
  link.download = `${generatedFileName}_QR.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
  function fileToBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  // Login Screen
  if (!accessToken) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">RSSB Digital QR Vault</h1>
        <p className="login-subtitle">
          Secure Document QR Generation System
        </p>

        <button className="login-button" onClick={() => window.login()}>
          Login with Google
        </button>
      </div>
    </div>
  );
  }

return (
  <div className="container">
    <h1>RSSB Digital QR Vault</h1>
    <div className="subtitle">
      Secure Document QR Generation System
    </div>

    <input
      className="doc-input"
      type="text"
      placeholder="Enter Document Name"
      value={docName}
      onChange={(e) => setDocName(e.target.value)}
    />

    <label className="secondary">
      Scan Page
      <input
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleScan}
        hidden
      />
    </label>

    {images.length > 0 && (
      <div className="file-list">
        Pages Added: {images.length}
      </div>
    )}

    {images.length > 0 && (
      <button className="primary" onClick={generatePDF}>
        Generate QR
      </button>
    )}

    {loading && <div className="loading">Processing document...</div>}

    {qr && (
  <div className="qr-section">
    <div className="qr-frame">
      <h3 className="qr-filename">{generatedFileName}</h3>
      <img src={qr} alt="QR Code" />
    </div>

    <div className="qr-actions">
      <button className="primary" onClick={() => window.print()}>
        Print QR
      </button>

      <button className="secondary" onClick={saveQR}>
        Save QR
      </button>
    </div>
  </div>
)}
  </div>
);
}

export default App;
