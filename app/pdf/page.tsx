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
    const [isOffline, setIsOffline] = useState(false);
    const [showDlModal, setShowDlModal] = useState(false);
    const [fileName, setFileName] = useState('');
    const [fileID, setFileID] = useState('');
    const router = useRouter();
    const [errorMsg, setErrorMsg] = useState('');
    const [prfAvailable, setPrfAvailable] = useState(0);

    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);
    const [encv2prf, setEncv2prf] = useLocalStorage<boolean>('encv2prf', false);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (window.PublicKeyCredential &&
            PublicKeyCredential.isConditionalMediationAvailable) {
            PublicKeyCredential.isConditionalMediationAvailable().then(result => {
                if (result === false) {
                    localStorage.removeItem('key');
                    localStorage.removeItem('iv');
                }
                setPrfAvailable(result ? 2 : 1);
            });
        } else {
            setPrfAvailable(1);
        }
    }, [router]);
    useEffect(() => {
        if (isOffline) {
            const interval = setInterval(() => {
                fetch('/api/is_online').then(() => {
                    setIsOffline(false);
                }).catch(() => {
                    setIsOffline(true);
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isOffline]);
    useEffect(() => {
        if (!account || !account.token) router.replace('/');
        else fetch(`/api/check_token`, {
            method: 'GET',
            headers: {
                Authorization: account.token,
                'X-Is-Mobile': navigator.maxTouchPoints > 0 ? '1' : '0'
            }
        }).then(response => {
            if (!response.ok) {
                router.replace('/');
            }
        })
    }, [router, account]);
    useEffect(() => {
        if (!encv2prf) {
            if (localStorage.getItem('key')) router.push('/pdf/setup/add_prf');
            else router.push('/pdf/setup');
        }
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
        }).catch(() => {
            setIsOffline(true);
        });
    }, [account, router, encv2prf]);
    useEffect(() => {
        if (prfAvailable === 1) {
            router.push('/pdf/setup');
            return;
        }
    }, [prfAvailable, router]);
    useEffect(() => {
        if (prfAvailable !== 2) return;
        if (encKey && dirIV && dirEnc && dirDEKEnc && dirDEKIV && encv2prf && localStorage.getItem('iv')) {
            navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32).fill(0),
                    timeout: 60000,
                    userVerification: 'required',
                    rpId: new URL('/', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000').hostname,
                    extensions: {
                        prf: {
                            eval: {
                                first: new TextEncoder().encode('Data Encryption')
                            }
                        }
                    }
                }
            }).then(async authResp => {
                if (!authResp || !(authResp as PublicKeyCredential).getClientExtensionResults) {
                    setErrorMsg(deviceLang === 1 ? "Passkey authentication failed." : '패스키 인증에 실패했습니다.');
                } else {
                    const clientExt = (authResp as PublicKeyCredential).getClientExtensionResults();
                    if (!clientExt || !clientExt.prf || (typeof clientExt.prf === 'object' && Object.keys(clientExt.prf).length === 0) || !clientExt.prf.results?.first) {
                        setErrorMsg(deviceLang === 1 ? "Passkey authentication failed." : '패스키 인증에 실패했습니다.');
                    } else {
                        const prfValue = clientExt.prf.results.first;
                        const key1 = await crypto.subtle.importKey('raw', prfValue, { name: 'HKDF' }, false, ['deriveKey']);
                        const key2 = await crypto.subtle.deriveKey({
                            name: 'HKDF',
                            hash: 'SHA-256',
                            salt: new Uint8Array(32).fill(0),
                            info: new TextEncoder().encode('Data Encryption')
                        }, key1, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']);
                        const encKeyBin = atob(encKey);
                        const encKeyBuf = new Uint8Array(encKeyBin.length);
                        for (let i = 0; i < encKeyBin.length; i++) {
                            encKeyBuf[i] = encKeyBin.charCodeAt(i);
                        }
                        crypto.subtle.unwrapKey('raw', encKeyBuf.buffer, key2, { name: 'AES-GCM', iv: new TextEncoder().encode(localStorage.getItem('iv')!) }, { name: 'AES-GCM' }, false, ['unwrapKey']).then(key => {
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
                    }
                }
            });
        }
    }, [encKey, dirIV, dirEnc, account, router, dirDEKEnc, dirDEKIV, deviceLang, encv2prf, prfAvailable]);

    return isOffline ? (
        <>
            <div className="kor">
                <Image src="/offline.svg" alt="오프라인 상태" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>오프라인 상태입니다.</h2>
                <p>로그인하려면 인터넷 연결이 필요합니다.</p>
            </div>
            <div className="eng">
                <Image src="/offline.svg" alt="Offline" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>You{'\''}re offline.</h2>
                <p>An active internet connection is required to login.</p>
            </div>
        </>
    ) : (
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