import { useState } from "react";
import QRCode from "qrcode";

function App() {
  const [qr, setQr] = useState("");

  async function handleFile(e) {
    const file = e.target.files[0];
    const accessToken = window.accessToken;

    const metadata = {
      name: `scan_${Date.now()}`,
      mimeType: file.type,
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", file);

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

    const link = `https://drive.google.com/uc?export=view&id=${uploaded.id}`;

    const qrData = await QRCode.toDataURL(link);
    setQr(qrData);
  }

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Scan → Drive → QR</h1>

      <div id="g_id_onload"
        data-client_id="YOUR_GOOGLE_CLIENT_ID"
        data-callback="handleCredentialResponse">
      </div>

      <div className="g_id_signin"></div>

      <input type="file" accept="image/*,.pdf" capture="environment" onChange={handleFile} />

      {qr && <img src={qr} alt="QR Code" style={{ marginTop: 20 }} />}
    </div>
  );
}

window.handleCredentialResponse = async function(response) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=YOUR_GOOGLE_CLIENT_ID&
           grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&
           assertion=${response.credential}`
  });

  const tokenData = await tokenRes.json();
  window.accessToken = tokenData.access_token;
};

export default App;
