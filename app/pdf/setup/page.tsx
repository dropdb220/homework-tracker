'use client';

import Link from 'next/link';
import Image from 'next/image';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount } from "@/app/types";

export default function RegisterEnc() {
    const router = useRouter();

    const [wsConnected, setWsConnected] = useState<boolean>(false);
    const [code, setCode] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isOffline, setIsOffline] = useState<boolean>(false);
    const [prfAvailable, setPrfAvailable] = useState<number>(0);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);
    const [encv2prf, setEncv2prf] = useLocalStorage<boolean>('encv2prf', false);

    useEffect(() => {
        if (!account || !account.token) {
            router.replace('/login');
        }
    }, [router, account]);
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
        if (window.PublicKeyCredential &&
            PublicKeyCredential.isConditionalMediationAvailable) {
            PublicKeyCredential.isConditionalMediationAvailable().then(result => {
                setPrfAvailable(result ? 2 : 1);
            });
        } else {
            setPrfAvailable(1);
        }
    }, [router]);
    useEffect(() => {
        if (prfAvailable !== 2) return;
        const socket = new WebSocket(`ws${location.hostname === 'localhost' ? '' : 's'}://${location.hostname}:${process.env.NEXT_PUBLIC_WS_PORT || location.port}/enc_setup_new`);
        let keyPair: CryptoKeyPair | null = null;
        let ecdhKey: CryptoKey | null = null;
        socket.addEventListener('open', () => {
            setWsConnected(true);
        });
        socket.addEventListener('message', ({ data }) => {
            const msg = JSON.parse(data.toString());
            switch (msg.type) {
                case 'auth':
                    socket.send(JSON.stringify({
                        type: 'auth',
                        token: account!.token
                    }));
                    break;
                case 'code':
                    setCode(msg.data.newCode);
                    break;
                case 'start':
                    crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']).then(key => {
                        crypto.subtle.exportKey('raw', key.publicKey).then(rawKey => {
                            keyPair = key;
                            socket.send(JSON.stringify({
                                type: 'ecdh_key',
                                key: btoa(String.fromCharCode(...new Uint8Array(rawKey)))
                            }));
                        });
                    })
                    break;
                case 'ecdh':
                    const keyBin = atob(msg.data.key);
                    const keyBuf = new Uint8Array(keyBin.length);
                    for (let i = 0; i < keyBin.length; i++) {
                        keyBuf[i] = keyBin.charCodeAt(i);
                    }
                    crypto.subtle.importKey('raw', keyBuf.buffer, { name: 'ECDH', namedCurve: 'P-256' }, false, []).then(key => {
                        crypto.subtle.deriveBits({ name: 'ECDH', public: key }, keyPair!.privateKey, 256).then(derivedBits => {
                            crypto.subtle.importKey('raw', derivedBits, { name: 'AES-GCM', length: 256 }, false, ['decrypt']).then(derivedKey => {
                                ecdhKey = derivedKey;
                                socket.send(JSON.stringify({
                                    type: 'ecdh_done'
                                }));
                            });
                        });
                    });
                    break;
                case 'data':
                    const dataBin = atob(msg.data.data);
                    const dataBuf = new Uint8Array(dataBin.length);
                    for (let i = 0; i < dataBin.length; i++) {
                        dataBuf[i] = dataBin.charCodeAt(i);
                    }
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
                                }, key1, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
                                crypto.subtle.decrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(msg.data.iv) }, ecdhKey!, dataBuf.buffer).then(decrypted => {
                                    const iv = crypto.randomUUID().split('-').reverse()[0];
                                    crypto.subtle.encrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(iv) }, key2, decrypted).then(enc => {
                                        localStorage.setItem('iv', iv);
                                        setEncv2prf(true);
                                        const encBin = btoa(String.fromCharCode(...new Uint8Array(enc)));
                                        socket.send(JSON.stringify({
                                            type: 'enc_data',
                                            data: encBin
                                        }));
                                    });
                                });
                            }
                        }
                    }).catch(() => {
                        setErrorMsg(deviceLang === 1 ? "Passkey authentication failed." : '패스키 인증에 실패했습니다.');
                    })
                    break;
                case 'complete':
                    router.replace('/pdf');
                    break;
            }
        });
    }, [prfAvailable, router, account, deviceLang, setEncv2prf]);

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
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <h1 className="text-3xl kor">암호화 설정하기</h1>
                <h1 className="text-3xl eng">Setup Encryption</h1>
            </div>
            <div className="lg:mt-24">
                <p className="kor">PDF를 다운로드하려면 암호화 설정이 필요합니다.</p>
                <p className="kor">암호화 설정에 앞서, <Link href="/register/passkey">패스키를 생성</Link>하세요.</p>
                <p className="kor">이후 이미 암호화 설정된 디바이스에서 메뉴-계정-정보 수정-PDF 암호화-새 기기 설정으로 이동하세요.</p>
                <p className="eng">Encryption setup is required to download PDFs.</p>
                <p className="eng">Before setting up encryption, please <Link href="/register/passkey">create a passkey</Link>.</p>
                <p className="eng">Then, on another device with encryption already set up, go to Menu - Account - Edit Info - PDF Encryption - Setup New Device.</p>
                <br />
                <label htmlFor="code" className="kor">{'설정 코드'}</label>
                <label htmlFor="code" className="eng">{'Setup Code'}</label>
                <br />
                {
                    prfAvailable === 0 ? (
                        <>
                            <h1 className="text-4xl font-bold kor">로딩 중...</h1>
                            <h1 className="text-4xl font-bold eng">Loading...</h1>
                        </>
                    ) : (
                        prfAvailable === 1 ? (
                            <>
                                <h1 className="text-4xl font-bold kor">지원하지 않는 브라우저</h1>
                                <h1 className="text-4xl font-bold eng">Unsupported Browser</h1>
                            </>
                        ) : (
                            <>
                                <h1 className="text-4xl font-bold kor">{code == '' ? '연결 중' : code}</h1>
                                <h1 className="text-4xl font-bold eng">{code == '' ? 'Connecting' : code}</h1>
                            </>
                        )
                    )
                }
                <br />
                {errorMsg !== '' && <p className="text-red-500">{errorMsg}</p>}
            </div>
        </div>
    );
}