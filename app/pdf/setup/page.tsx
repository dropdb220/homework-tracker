'use client';

import Link from 'next/link';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount } from "@/app/types";

export default function RegisterEnc() {
    const router = useRouter();

    const [wsConnected, setWsConnected] = useState<boolean>(false);
    const [code, setCode] = useState<string>('');

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        if (!account || !account.token) {
            router.replace('/login');
        }
    }, [router, account]);
    useEffect(() => {
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
                    crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']).then(async (newKey) => {
                        crypto.subtle.decrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(msg.data.iv) }, ecdhKey!, dataBuf.buffer).then(decrypted => {
                            const iv = crypto.randomUUID().split('-').reverse()[0];
                            crypto.subtle.encrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(iv) }, newKey, decrypted).then(enc => {
                                crypto.subtle.exportKey('jwk', newKey).then(jwk => {
                                    localStorage.setItem('key', JSON.stringify(jwk));
                                    localStorage.setItem('iv', iv);
                                    const encBin = btoa(String.fromCharCode(...new Uint8Array(enc)));
                                    socket.send(JSON.stringify({
                                        type: 'enc_data',
                                        data: encBin
                                    }));
                                });
                            });
                        });
                    });
                    break;
                case 'complete':
                    router.replace('/pdf');
                    break;
            }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    console.log(code)

    return (
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <h1 className="text-3xl kor">암호화 설정하기</h1>
                <h1 className="text-3xl eng">Setup Encryption</h1>
            </div>
            <div className="lg:mt-24">
                <p className="kor">PDF를 다운로드하려면 암호화 설정이 필요합니다.</p>
                <p className="kor">이미 암호화 설정된 디바이스에서 메뉴-계정-정보 수정-PDF 암호화-새 기기 설정으로 이동하세요.</p>
                <p className="eng">Encryption setup is required to download PDFs.</p>
                <p className="eng">On another device with encryption already set up, go to Menu - Account - Edit Info - PDF Encryption - Setup New Device.</p>
                <br />
                <label htmlFor="code" className="kor">{'설정 코드'}</label>
                <label htmlFor="code" className="eng">{'Setup Code'}</label>
                <br />
                <h1 className="text-4xl font-bold kor">{code == '' ? '연결 중' : code}</h1>
                <h1 className="text-4xl font-bold eng">{code == '' ? 'Connecting' : code}</h1>
            </div>
        </div>
    );
}