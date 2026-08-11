'use client';

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { jsPDF } from 'jspdf';

export default function WaiverPage() {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [tenantId, setTenantId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const submitWaiver = async () => {
    if (!tenantId || !profileId) {
      setMessage('Please provide tenant and profile IDs (for testing).');
      return;
    }

    if (sigCanvas.current?.isEmpty()) {
      setMessage('Please sign the waiver before submitting.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Get signature image
      const signatureImage = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');

      // Generate PDF
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text('Gym Liability Waiver', 20, 20);
      doc.setFontSize(12);
      const waiverText = `I agree to assume all risks associated with the use of the gym facilities. I will not hold the gym liable for any injuries.`;
      doc.text(waiverText, 20, 40, { maxWidth: 170 });

      doc.text('Signature:', 20, 80);
      if (signatureImage) {
        doc.addImage(signatureImage, 'PNG', 20, 90, 80, 30);
      }

      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 140);
      doc.text(`Tenant ID: ${tenantId}`, 20, 150);
      doc.text(`Profile ID: ${profileId}`, 20, 160);

      // Get PDF as Blob
      const pdfBlob = doc.output('blob');

      // Prepare form data
      const formData = new FormData();
      formData.append('pdf', pdfBlob, 'waiver.pdf');
      formData.append('tenant_id', tenantId);
      formData.append('profile_id', profileId);

      // Send to backend
      const response = await fetch('http://localhost:3001/api/waivers/sign', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Waiver signed and submitted successfully!');
        clearSignature();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      setMessage('An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Digital Liability Waiver</h1>

        <div className="mb-6 space-y-4 text-gray-700">
          <p>Please read carefully before signing:</p>
          <p className="p-4 bg-gray-100 rounded text-sm">
            I agree to assume all risks associated with the use of the gym facilities. I will not hold the gym liable for any injuries, damages, or losses. I confirm that I am physically fit to participate in the activities.
          </p>
        </div>

        <div className="mb-4 space-y-4">
           <input
              type="text"
              placeholder="Tenant ID"
              className="w-full border p-2 rounded text-black"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
           />
           <input
              type="text"
              placeholder="Profile ID"
              className="w-full border p-2 rounded text-black"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
           />
        </div>

        <div className="mb-4 border-2 border-gray-300 rounded overflow-hidden">
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            canvasProps={{className: 'w-full h-48 bg-gray-50'}}
          />
        </div>

        <div className="flex justify-between items-center mb-4">
          <button
            onClick={clearSignature}
            className="text-gray-500 hover:text-gray-700 underline"
            disabled={loading}
          >
            Clear Signature
          </button>
        </div>

        {message && (
          <div className={`p-4 mb-4 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        <button
          onClick={submitWaiver}
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Sign and Accept' : 'Sign and Accept'}
        </button>
      </div>
    </div>
  );
}
