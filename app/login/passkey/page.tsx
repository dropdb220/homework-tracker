'use client';

import Link from "next/link";
import Image from "next/image";

import { startAuthentication } from "@simplewebauthn/browser";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount } from "@/app/types";

export default function LoginPhase1() {
    const router = useRouter();

    const [id, setId] = useState('');
    const [loginFailed, setLoginFailed] = useState(false);
    const [loggingIn, setLoggingIn] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [errorCnt, setErrorCnt] = useState(0);
    const [isOffline, setIsOffline] = useState(false);
    const [justLoggedIn, setJustLoggedIn] = useState(false);
    const [passkeySuccess, setPasskeySuccess] = useState(false);
    const [showTraditional, setShowTraditional] = useState(false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);

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
                if (!result) router.replace('/login/id');
            });
        }
    }, [router]);
    useEffect(() => {
        document.documentElement.style.setProperty("--viewport-width", ((document.querySelector('main') as HTMLElement).clientWidth / 9 * 10).toString());
        return () => document.documentElement.style.setProperty("--viewport-width", "100vw");
    });

    if (account && account.token && !justLoggedIn) router.replace('/account');

    return isOffline ? (
        <>
            <Image src="/offline.svg" alt="오프라인 상태" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
            <h2>오프라인 상태입니다.</h2>
            <p>로그인하려면 인터넷 연결이 필요합니다.</p>
        </>
    ) : (
        <div>
            <h1 className="text-3xl">로그인</h1>
            <br />
            <button className="w-[60%] ml-[20%] mr-[20%] pt-3 pb-3 mt-8 mb-16 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring" onClick={(e) => {
                fetch('/api/passkey/login/prepare')
                    .then(res => res.json())
                    .then((data) => {
                        startAuthentication(data.options)
                            .then(authResp => {
                                fetch('/api/passkey/login', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ session: data.session, response: authResp })
                                })
                                    .then(res => {
                                        if (res.ok) {
                                            res.json().then(res => {
                                                setPasskeySuccess(true);
                                                setErrorMsg('');
                                                setJustLoggedIn(true);
                                                setAccount({ id: res.id, token: res.token });
                                                router.push('/');
                                            });
                                        } else {
                                            res.json().then(res => {
                                                setPasskeySuccess(false);
                                                setErrorMsg(res.msg);
                                                setErrorCnt(errorCnt + 1);
                                            });
                                        }
                                    })
                            })
                            .catch(() => {
                                setErrorCnt(errorCnt + 1);
                            });
                    }).catch(() => {
                        setIsOffline(true);
                    })
            }}>패스키로 로그인</button>
            {errorMsg === '' ? <><br /><br /></> : <p className="text-red-500">{errorMsg}</p>}
            <button className={`w-full ml-auto mr-auto pb-8 ${errorCnt > 0 ? 'block' : 'hidden'}`} onClick={(e) => {
                setShowTraditional(!showTraditional);
            }}>비밀번호로 로그인</button>
            <form className={`border-t-slate-300 border-t pt-8 ${showTraditional ? 'block' : 'hidden'}`} onSubmit={e => {
                e.preventDefault();
                setLoggingIn(true);
                fetch('/api/check_id?id=' + encodeURIComponent(id)).then(async res => {
                    if (res.ok) {
                        setLoginFailed(false);
                        if (passkeySuccess) return;
                        setAccount({ id });
                        router.push('/login/password');
                    } else {
                        setLoggingIn(false);
                        setLoginFailed(true);
                    }
                }).catch(() => {
                    setIsOffline(true);
                })
            }}>
                <input type="text" id="id" placeholder="아이디" className="border border-slate-400 h-12 rounded-lg p-4 w-[100%] dark:bg-[#424242]" autoComplete="username webauthn" autoFocus onChange={e => {
                    setId(e.currentTarget.value);
                    setLoginFailed(false);
                }} />
                {loginFailed ? <p className="text-red-500">입력한 ID는 존재하지 않습니다.</p> : <br />}
                <br />
                <br />
                <br />
                <Link href="/register">
                    <input type="button" className="w-[40%] ml-0" value="계정 생성" />
                </Link>
                <button className="w-[40%] ml-[20%] mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring" disabled={id.length === 0 || loggingIn} type="submit">다음</button>
            </form>
        </div>
    );
}