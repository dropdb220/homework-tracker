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
    const [isClient, setIsClient] = useState<boolean>(false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        fetch('/api/passkey/login/prepare')
            .then(res => res.json())
            .then((data) => {
                startAuthentication({ optionsJSON: data.options, useBrowserAutofill: true })
                    .then(authResp => {
                        fetch('/api/passkey/login', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Is-Mobile': navigator.maxTouchPoints > 0 ? '1' : '0'
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
                    .catch(err => { });
            }).catch(() => {
                setIsOffline(true);
            })
    }, [router, setAccount, errorCnt]);
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

    if (account && account.token && !justLoggedIn) router.replace('/account');

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
            <style>
                {`#logo_text {
                    color: black !important;
                }`}
            </style>
            <div className="w-full lg:w-[80%] p-16 mt-24 rounded-2xl md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto bg-[rgb(var(--background-rgb))]">
                <div className="mb-4 lg:mt-24">
                    <h1 className="text-2xl font-bold kor">돌아오신 것을 환영해요!</h1>
                    <h1 className="text-xl kor">다시 만나다니 정말 반가워요!</h1>
                    <h1 className="text-2xl font-bold eng">Welcome Back!</h1>
                    <h1 className="text-xl eng">We{'\''}re so excited to see you again!</h1>
                </div>
                <div className="lg:mt-24">
                    <form onSubmit={e => {
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
                        <input type="text" id="id" placeholder={(deviceLang === 1 && isClient) ? "ID" : "아이디"} className="border border-slate-400 h-12 rounded-lg p-4 w-full dark:bg-[#424242]" autoComplete="username webauthn" autoFocus onChange={e => {
                            setId(e.currentTarget.value);
                            setLoginFailed(false);
                        }} />
                        {errorMsg === '' ? <><br /><br /></> : <p className="text-red-500">{errorMsg}</p>}
                        {loginFailed ? <><p className="text-red-500 kor">입력한 ID는 존재하지 않습니다.</p><p className="text-red-500 eng">The ID doesn&apos;t exist.</p></> : <br />}
                        <br />
                        <br />
                        <br />
                        <Link href="/register">
                            <input type="button" className="w-[40%] ml-0 kor" value="계정 생성" />
                            <input type="button" className="w-[40%] ml-0 eng" value="Create Account" />
                        </Link>
                        <button className="w-[40%] ml-[20%] mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" disabled={id.length === 0 || loggingIn} type="submit">
                            <span className="kor">다음</span>
                            <span className="eng">Next</span>
                        </button>
                    </form>
                </div>
            </div>
            <div className="-z-2 fixed top-0 left-0 w-dvw h-dvh bg-[url(/login_background.png)] bg-cover"></div>
        </>
    );
}