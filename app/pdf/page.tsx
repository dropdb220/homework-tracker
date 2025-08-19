'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocalStorage } from 'usehooks-ts';
import { LSAccount } from "@/app/types";
import DlModal from './dlModal';

export default function PDFDownload() {
    const [key, setKey] = useState<CryptoKey | null>(null);
    const [encKey, setEncKey] = useState<string | null>(null);
    const [dirIV, setDirIV] = useState<string | null>(null);
    const [dirEnc, setDirEnc] = useState<string | null>(null);
    const [dirDEKEnc, setDirDEKEnc] = useState<string | null>(null);
    const [dirDEKIV, setDirDEKIV] = useState<string | null>(null);
    const [dir, setDir] = useState<any>(null);
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
        if (!localStorage.getItem('key') || !localStorage.getItem('iv')) router.push('/pdf/setup');
        fetch('/api/pdf/v2/dir', {
            method: 'POST',
            headers: {
                Authorization: account?.token ?? ''
            }
        }).then(r => r.json()).then(data => {
            if (data.code === 2) router.push('/pdf/setup');
            else if (data.code === 1) {
                alert(data.msg);
                router.refresh();
            } else {
                setDirEnc(data.dirEnc);
                setDirIV(data.dirIV);
                setEncKey(data.encryptedKey);
                setDirDEKEnc(data.dirDEK);
                setDirDEKIV(data.dirDEKIV);
            }
        });
    }, [account, router]);
    useEffect(() => {
        if (encKey && dirIV && dirEnc && dirDEKEnc && dirDEKIV && localStorage.getItem('key') && localStorage.getItem('iv')) {
            crypto.subtle.importKey('jwk', JSON.parse(localStorage.getItem('key')!), { name: 'AES-GCM' }, false, ['unwrapKey']).then(privKey => {
                const encKeyBin = atob(encKey);
                const encKeyBuf = new Uint8Array(encKeyBin.length);
                for (let i = 0; i < encKeyBin.length; i++) {
                    encKeyBuf[i] = encKeyBin.charCodeAt(i);
                }
                crypto.subtle.unwrapKey('raw', encKeyBuf.buffer, privKey, { name: 'AES-GCM', iv: new TextEncoder().encode(localStorage.getItem('iv')!) }, { name: 'AES-GCM' }, false, ['unwrapKey']).then(key => {
                    const dirDEKBin = atob(dirDEKEnc);
                    const dirDEKBuf = new Uint8Array(dirDEKBin.length);
                    for (let i = 0; i < dirDEKBin.length; i++) {
                        dirDEKBuf[i] = dirDEKBin.charCodeAt(i);
                    }
                    setKey(key);
                    crypto.subtle.unwrapKey('raw', dirDEKBuf.buffer, key, { name: 'AES-GCM', iv: new TextEncoder().encode(dirDEKIV) }, { name: 'AES-GCM' }, false, ['decrypt']).then(dirDEK => {
                        const dirEncBin = atob(dirEnc);
                        const dirEncBuf = new Uint8Array(dirEncBin.length);
                        for (let i = 0; i < dirEncBin.length; i++) {
                            dirEncBuf[i] = dirEncBin.charCodeAt(i);
                        }
                        crypto.subtle.decrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(dirIV) }, dirDEK, dirEncBuf.buffer).then(decrypted => {
                            const dirData = JSON.parse(new TextDecoder().decode(decrypted));
                            setDir(dirData);
                        });
                    });
                });
            });
        }
    }, [encKey, dirIV, dirEnc, account, router, dirDEKEnc, dirDEKIV]);

    return (
        <>
            {
                !dir && (
                    <>
                        <h1 className="text-4xl kor text-center">파일 목록 구성 중...</h1>
                        <h1 className="text-4xl eng text-center">Generating list of files...</h1>
                    </>
                )
            }
            {
                dir && (
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
                showDlModal && key && <DlModal token={account?.token ?? ""} mKey={key} fileName={fileName} fileID={fileID} setShowModal={setShowDlModal} />
            }
        </>
    )
}