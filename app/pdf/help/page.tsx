'use client';

import Link from 'next/link';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount } from "@/app/types";

export default function RegisterEnc() {
    const router = useRouter();

    const [code, setCode] = useState<string>('');

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);

    useEffect(() => {
        if (!account || !account.token) {
            router.replace('/login');
        }
    }, [router, account]);

    return (
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <h1 className="text-3xl kor">새 기기에 암호화 설정하기</h1>
                <h1 className="text-3xl eng">Setup Encryption on New Device</h1>
            </div>
            <div className="lg:mt-24">
                <p className="kor">PDF를 다운로드하려면 암호화 설정이 필요합니다.</p>
                <p className="eng">Encryption setup is required to download PDFs.</p>
                <br />
                <label htmlFor="code" className="kor">{'설정 코드'}</label>
                <label htmlFor="code" className="eng">{'Setup Code'}</label>
                <br />
                <input type="text" id="code" value={code} className="border border-slate-400 h-12 rounded-lg p-4 w-[45%] dark:bg-[#424242]" onChange={e => {
                    setCode(e.currentTarget.value);
                }} />
                <br />
                <button className="w-[20%] mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" onClick={e => {
                    let keyPair: CryptoKeyPair | null = null;
                    const socket = new WebSocket(`ws${location.hostname === 'localhost' ? '' : 's'}://${location.hostname}:${process.env.NEXT_PUBLIC_WS_PORT || location.port}/enc_setup_old`);
                    socket.addEventListener('message', ({ data }) => {
                        const msg = JSON.parse(data.toString());
                        switch (msg.type) {
                            case 'auth':
                                socket.send(JSON.stringify({
                                    type: 'auth',
                                    token: account!.token,
                                    code
                                }));
                                break;
                            case 'start':
                                crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']).then(key => {
                                    keyPair = key;
                                    crypto.subtle.exportKey('raw', key.publicKey).then(rawKey => {
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
                                crypto.subtle.importKey('raw', keyBuf.buffer, { name: 'ECDH', namedCurve: 'P-256' }, false, []).then(async key => {
                                    crypto.subtle.deriveBits({ name: 'ECDH', public: key }, keyPair!.privateKey, 256).then(derivedBits => {
                                        crypto.subtle.importKey('raw', derivedBits, { name: 'AES-GCM', length: 256 }, false, ['wrapKey']).then(derivedKey => {
                                            key = derivedKey;
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
                                                        crypto.subtle.wrapKey('raw', key, derivedKey, { name: 'AES-GCM', iv: new TextEncoder().encode(iv) }).then(enc => {
                                                            socket.send(JSON.stringify({
                                                                type: 'ecdh_done',
                                                                data: btoa(String.fromCharCode(...new Uint8Array(enc))),
                                                                iv
                                                            }));
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                                break;
                            case 'complete':
                                router.push('/');
                                break;
                        }
                    });
                }}>
                    <span className="kor">확인</span>
                    <span className="eng">OK</span>
                </button>
            </div>
        </div>
    );
}