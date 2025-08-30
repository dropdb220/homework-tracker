'use client';

import Link from 'next/link';
import Image from 'next/image';

import { startAuthentication } from "@simplewebauthn/browser";
import { generateAuthenticationOptions } from '@simplewebauthn/server';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount } from "@/app/types";

export default function UpgradeEncWithPrf() {
    const router = useRouter();

    const [prfAvailable, setPrfAvailable] = useState<number>(0);
    const [isOffline, setIsOffline] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [encv2prf, setEncv2prf] = useLocalStorage<any>('encv2prf', false);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        if (!account || !account.token) {
            router.replace('/login');
        } else if (encv2prf) {
            router.replace('/pdf');
        } else if (!localStorage.getItem('key') || !localStorage.getItem('iv')) {
            router.replace('/pdf/setup');
        }
    }, [router, account, encv2prf]);
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
                <h1 className="text-3xl kor">암호화 업그레이드</h1>
                <h1 className="text-3xl eng">Upgrade Encryption</h1>
            </div>
            <div className="lg:mt-24">
                <p className="kor">PDF를 계속 다운로드하려면 암호화 업그레이드가 필요합니다.</p>
                <p className="kor">아래 버튼을 클릭하여 패스키로 인증하세요.</p>
                <p className="kor">패스키가 없을 경우, <Link href="/register/passkey">여기</Link>에서 등록할 수 있습니다.</p>
                <p className="eng">Encryption upgrade is required to continue downloading PDFs.</p>
                <p className="eng">Click the button below and authenticate with Passkey.</p>
                <p className="eng">If you don{"'"}t have a Passkey, you can register one <Link href="/register/passkey">here</Link>.</p>
                <br />
                <br />
                {prfAvailable === 0 ? (
                    <>
                        <p className='kor'>시스템 지원 여부 확인 중...</p>
                        <p className='eng'>Checking system support...</p>
                    </>
                ) : (prfAvailable === 1 ? (
                    <>
                        <p className='kor'>패스키가 지원되지 않는 환경입니다.</p>
                        <p className='kor'>다른 기기에서 시도하거나 브라우저를 업데이트하세요.</p>
                        <p className='eng'>Passkey is not supported on this device.</p>
                        <p className='eng'>Try on another device or update your browser.</p>
                    </>
                ) : (
                    <button className="w-full pt-4 pb-4 pl-8 pr-8 max-md:mt-8 mb-16 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" onClick={async (e) => {
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
                                    }, key1, { name: 'AES-GCM', length: 256 }, false, ['wrapKey']);
                                    fetch('/api/pdf/v2/dir', {
                                        method: 'POST',
                                        headers: {
                                            Authorization: account!.token!
                                        }
                                    }).then(r => r.json()).then(data => {
                                        if (data.code !== 0) {
                                            alert(data.msg);
                                            return;
                                        }
                                        crypto.subtle.importKey('jwk', JSON.parse(localStorage.getItem('key')!), { name: 'AES-GCM' }, false, ['unwrapKey']).then(privKey => {
                                            const encKeyBin = atob(data.encryptedKey);
                                            const encKeyBuf = new Uint8Array(encKeyBin.length);
                                            for (let i = 0; i < encKeyBin.length; i++) {
                                                encKeyBuf[i] = encKeyBin.charCodeAt(i);
                                            }
                                            crypto.subtle.unwrapKey('raw', encKeyBuf.buffer, privKey, { name: 'AES-GCM', iv: new TextEncoder().encode(localStorage.getItem('iv')!) }, { name: 'AES-GCM' }, true, ['wrapKey']).then(key => {
                                                const iv = crypto.randomUUID().split('-').reverse()[0];
                                                crypto.subtle.wrapKey('raw', key, key2, { name: 'AES-GCM', iv: new TextEncoder().encode(iv) }).then(enc => {
                                                    fetch('/api/pdf/v2/upgrade_prf', {
                                                        method: 'POST',
                                                        headers: {
                                                            Authorization: account!.token!,
                                                            'Content-Type': 'application/json'
                                                        },
                                                        body: JSON.stringify({
                                                            enc: btoa(String.fromCharCode(...new Uint8Array(enc))),
                                                            iv
                                                        })
                                                    }).then(res => res.json()).then(data => {
                                                        if (data.code !== 0) {
                                                            setErrorMsg((deviceLang === 1 ? "An error occurred during upgrade." : '업그레이드 작업 중 오류가 발생했습니다.') + (data.msg ? ` (${data.msg})` : ''));
                                                            return;
                                                        }
                                                        setEncv2prf(true);
                                                        localStorage.removeItem('key');
                                                        localStorage.setItem('iv', iv);
                                                        router.replace('/pdf');
                                                    }).catch(e => {
                                                        setErrorMsg((deviceLang === 1 ? "An error occurred during upgrade." : '업그레이드 작업 중 오류가 발생했습니다.') + (e?.message ? ` (${e.message})` : ''));
                                                    });
                                                });
                                            });
                                        });
                                    });
                                }
                            }
                        }).catch(e => {
                            setErrorMsg((deviceLang === 1 ? "An error occurred during authentication." : '인증 중 오류가 발생했습니다.') + (e?.message ? ` (${e.message})` : ''));
                        });
                    }}>
                        <span className="kor">패스키로 인증</span>
                        <span className="eng">Authenticate with Passkey</span>
                    </button>
                ))}
                <br />
                {errorMsg !== '' && <p className="text-red-500">{errorMsg}</p>}
            </div>
        </div>
    );
}