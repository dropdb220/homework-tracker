'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocalStorage } from 'usehooks-ts';
import PasscodeModal from "@/app/pdf/passcodeModal";
import { LSAccount } from "@/app/types";
import DlModal from './dlModal';

export default function PDFDownload() {
    const [key, setKey] = useState<string | null>(null);
    const [salt, setSalt] = useState<string | null>(null);
    const [dirIV, setDirIV] = useState<string | null>(null);
    const [dirEnc, setDirEnc] = useState<string | null>(null);
    const [dir, setDir] = useState<any>(null);
    const [derivedKey, setDerivedKey] = useState<any>(null);
    const [cwd, setCwd] = useState<Array<string>>([]);
    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [isClient, setIsClient] = useState(false);
    const [showDlModal, setShowDlModal] = useState(false);
    const [fileName, setFileName] = useState('');
    const [fileID, setFileID] = useState('');
    const router = useRouter();

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (!account || !account.token) router.replace('/');
        else fetch(`/api/check_token`, {
            method: 'GET',
            headers: {
                Authorization: account.token
            }
        }).then(response => {
            if (!response.ok) {
                router.replace('/');
            }
        })
    }, [router, account]);
    useEffect(() => {
        if (key && salt && dirIV && dirEnc) {
            crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'PBKDF2' }, false, ['deriveKey']).then(key1 => {
                crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 1000000 }, key1, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']).then(key2 => {
                    setDerivedKey(key2);
                    const dirEncBin = atob(dirEnc);
                    const dirEncBuf = new Uint8Array(dirEncBin.length);
                    for (let i = 0; i < dirEncBin.length; i++) {
                        dirEncBuf[i] = dirEncBin.charCodeAt(i);
                    }
                    crypto.subtle.decrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(dirIV) }, key2, dirEncBuf.buffer).then(decrypted => {
                        console.log(JSON.parse(new TextDecoder().decode(decrypted)))
                        setDir(JSON.parse(new TextDecoder().decode(decrypted)));
                    })
                });
            });
        }
    }, [key, salt, dirIV, dirEnc]);

    return (
        <>
            {
                !key && <PasscodeModal token={account?.token ?? ''} setKey={setKey} setSalt={setSalt} setIV={setDirIV} setDirEnc={setDirEnc} />
            }
            {
                key && !dir && (
                    <>
                        <h1 className="text-4xl kor text-center">파일 목록 구성 중...</h1>
                        <h1 className="text-4xl eng text-center">Generating list of files...</h1>
                    </>
                )
            }
            {
                key && dir && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] w-full ml-auto mr-auto">
                        {cwd.length > 0 &&
                            <>
                                <div className="kor ml-auto mr-auto" onClick={() => {
                                    setCwd(cwd.slice(0, -1));
                                }}>
                                    <Image width={64} height={64} src="/folder.svg" alt="뒤로가기" className="w-16 h-16 ml-auto mr-auto" />
                                    <div className="text-center">{'(뒤로가기)'}</div>
                                </div>
                                <div className="eng ml-auto mr-auto" onClick={() => {
                                    setCwd(cwd.slice(0, -1));
                                }}>
                                    <Image width={64} height={64} src="/folder.svg" alt="Back" className="w-16 h-16 ml-auto mr-auto" />
                                    <div className="text-center">{'(Back)'}</div>
                                </div>
                            </>
                        }
                        {
                            cwd.reduce((directory, path) => directory.find((x: any) => x.name === path).children, dir).map((entry: any, idx: number) => (
                                <div key={idx} className="ml-auto mr-auto" onClick={() => {
                                    if (entry.type === 1) setCwd([...cwd, entry.name]);
                                    else {
                                        setFileName(entry.name);
                                        setFileID(entry.id);
                                        setShowDlModal(true);
                                    }
                                }}>
                                    <Image width={64} height={64} src={entry.type === 1 ? '/folder.svg' : '/file.svg'} alt={entry.name} className="w-16 h-16 ml-auto mr-auto" />
                                    <div className="text-center">{entry.name}</div>
                                </div>
                            ))
                        }
                    </div>
                )
            }
            {
                showDlModal && <DlModal token={account?.token ?? ""} dKey={derivedKey} fileName={fileName} fileID={fileID} setShowModal={setShowDlModal} />
            }
        </>
    )
}