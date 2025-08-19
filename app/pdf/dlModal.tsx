import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function DlModal({ token, mKey, fileName, fileID, setShowModal }: { token: string, mKey: CryptoKey, fileName: string, fileID: string, setShowModal: React.Dispatch<React.SetStateAction<boolean>> }) {
    const [phase, setPhase] = useState(0);
    const [dlProgress, setDlProgress] = useState(0);

    return (
        <>
            <div className="bg-[rgb(239,239,240)] dark:bg-[rgb(32,32,32)] flex flex-col justify-start items-center pt-25 rounded-lg z-20 fixed top-1/2 left-1/2 -translate-1/2 w-[min(90vw,700px)] h-[min(90vh,500px)]">
                <button onClick={(() => { setShowModal(false); })}>
                    <Image src="/close.svg" alt="Close" width={32} height={32} className="fixed top-0 right-0 m-4 dark:invert" />
                </button>
                <Image src="/file.svg" alt="File" width={96} height={96} />
                <br />
                <div>{fileName}</div>
                <br /><br />
                {
                    phase === 0 && (
                        <>
                            <button className="p-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" onClick={(() => {
                                setPhase(1);
                                fetch(`/api/pdf/v2/download/${fileID}`, {
                                    method: 'POST',
                                    headers: {
                                        Authorization: token
                                    }
                                }).then(r => r.json()).then(d => {
                                    setPhase(2);
                                    setDlProgress(0);
                                    fetch(d.url).then(async res => {
                                        const totalLen = parseInt(res.headers.get('Content-Length') || '-1');
                                        let loaded = 0;
                                        const values = [];
                                        if (totalLen !== -1) setDlProgress(-1);
                                        const reader = res.body!.getReader();
                                        while (true) {
                                            const { done, value } = await reader.read();
                                            if (done) break;
                                            values.push(value)
                                            loaded += value.byteLength;
                                            if (dlProgress >= 0) setDlProgress(Math.floor(loaded / totalLen * 100));
                                        }
                                        setPhase(3);
                                        const DEKBin = atob(d.encryptedKey);
                                        const DEKBuf = new Uint8Array(DEKBin.length);
                                        for (let i = 0; i < DEKBin.length; i++) {
                                            DEKBuf[i] = DEKBin.charCodeAt(i);
                                        }
                                        const DEK = await crypto.subtle.unwrapKey('raw', DEKBuf.buffer, mKey, { name: 'AES-GCM', iv: new TextEncoder().encode(d.iv) }, { name: 'AES-GCM' }, false, ['decrypt']);
                                        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(fileID) }, DEK, await new Blob(values).arrayBuffer());
                                        const blob = new Blob([decrypted], { type: 'application/octet-stream' });
                                        setPhase(4);
                                        const a = document.createElement('a');
                                        a.href = URL.createObjectURL(blob);
                                        a.download = fileName;
                                        a.click();
                                    });
                                });
                            })}>
                                <p className="kor">다운로드</p>
                                <p className="eng">Download</p>
                            </button>
                        </>
                    )
                }
                {
                    phase === 1 && (
                        <>
                            <p className="kor">다운로드 URL 받는 중...</p>
                            <p className="eng">Retrieving Download URL...</p>
                        </>
                    )
                }
                {
                    phase === 2 && (
                        <>
                            <p className="kor">다운로드 중...</p>
                            <p className="eng">Downloading...</p>
                            {dlProgress >= 0 ? <progress className="[&::-webkit-progress-bar]:rounded-lg [&::-webkit-progress-value]:rounded-lg [&::-webkit-progress-bar]:bg-slate-300 [&::-webkit-progress-value]:bg-blue-500 [&::-moz-progress-bar]:bg-blue-500" value={dlProgress} max="100"></progress> : <progress className="[&::-webkit-progress-bar]:rounded-lg [&::-webkit-progress-value]:rounded-lg [&::-webkit-progress-bar]:bg-slate-300 [&::-webkit-progress-value]:bg-blue-500 [&::-moz-progress-bar]:bg-blue-500"></progress>}
                        </>
                    )
                }
                {
                    phase === 3 && (
                        <>
                            <p className="kor">복호화 중...</p>
                            <p className="eng">Decrypting...</p>
                        </>
                    )
                }
                {
                    phase === 4 && (
                        <>
                            <p className="kor">다운로드 완료</p>
                            <p className="eng">Download Complete</p>
                        </>
                    )
                }
            </div>
            <div className={`bg-black opacity-80 fixed top-0 left-0 w-full h-full z-10`}></div>
        </>
    )
}