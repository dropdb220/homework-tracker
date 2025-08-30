'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';

import type { LSAccount } from './types';
import { set } from 'date-fns';

export default function Header() {
    const [isValidToken, setIsValidToken] = useState(false);
    const [showUtilMenu, setShowUtilMenu] = useState(false);
    const [isUnlockingPDF, setIsUnlockingPDF] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [lang, setLang] = useLocalStorage('lang', -1);
    const [isClient, setIsClient] = useState(false)

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [encv2prf, setEncv2prf] = useLocalStorage<boolean>('encv2prf', false);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (!isClient) return;
        if (lang === -1) {
            setLang(navigator.language.startsWith('en') ? 1 : 0);
        }
    }, [lang, setLang, isClient]);
    useEffect(() => {
        if (navigator.userAgent.includes('KAKAO')) {
            location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
        }
    }, []);
    useEffect(() => {
        if (account && account.token) {
            fetch('/api/check_token', {
                headers: { Authorization: account.token }
            }).then(async res => {
                if (res.ok) {
                    setIsValidToken(true);
                    fetch('/api/account?id=' + account.id).then(async res => {
                        if (res.ok) {
                            setLang((await res.json()).data.lang);
                        }
                    }).catch(() => {
                        setIsValidToken(true);
                    });
                } else {
                    setIsValidToken(false);
                    setEncv2prf(false);
                    localStorage.removeItem('key');
                    localStorage.removeItem('iv');
                    setAccount(null);
                }
            }).catch(() => {
                setIsValidToken(true);
            });
        }
    }, [account, setAccount, setLang, setEncv2prf]);

    return (
        <>
            {lang !== 0 && isClient &&
                <style>
                    {`
                        body .kor {
                            display: none !important;
                        }
                    `}
                </style>
            }
            {(lang !== 1 || !isClient) &&
                <style>
                    {`
                        body .eng {
                            display: none !important;
                        }
                    `}
                </style>
            }
            <header className={`sticky w-full grid grid-cols-[auto_1fr_auto${(account && account.token && isValidToken) ? '_auto' : ''}] p-4 h-24`}>
                <Link href="/" className="grid grid-cols-[auto_auto]">
                    {/*eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icon3.png" alt={process.env.NEXT_PUBLIC_TITLE || '숙제 트래커'} width={48} height={48} className="h-12 w-12 kor" />
                    {/*eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icon3.png" alt={process.env.NEXT_PUBLIC_TITLE_EN || process.env.NEXT_PUBLIC_TITLE || 'Homework Tracker'} width={48} height={48} className="h-12 w-12 eng" />
                    <div className="grid grid-rows-[1fr_auto_1fr] h-12">
                        <div></div>
                        <span className="kor ml-2 text-3xl font-semibold">{process.env.NEXT_PUBLIC_TITLE || '숙제 트래커'}</span>
                        <span className="eng ml-2 text-3xl font-semibold">{process.env.NEXT_PUBLIC_TITLE_EN || process.env.NEXT_PUBLIC_TITLE || 'Homework Tracker'}</span>
                        <div></div>
                    </div>
                </Link>
                <div className="grid-cols-[auto_1fr_auto_auto]"></div>

                {account && account.token && isValidToken
                    ? <>
                        <button className="h-9 hidden md:block" onClick={e => {
                            setShowUtilMenu(!showUtilMenu);
                            e.preventDefault();
                        }}>
                            {/*eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/menu.svg" alt="메뉴" width={36} height={36} className="kor dark:invert mr-2 mt-1.5 mb-1.5 h-9" />
                            {/*eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/menu.svg" alt="Menu" width={36} height={36} className="eng dark:invert mr-2 mt-1.5 mb-1.5 h-9" />
                        </button>
                        <Link href="/account" className="hidden md:inline">
                            {/*eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/account.svg" alt="계정" width={36} height={36} className="kor dark:invert mr-2 mt-1.5 mb-1.5 h-9" />
                            {/*eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/account.svg" alt="Account" width={36} height={36} className="eng dark:invert mr-2 mt-1.5 mb-1.5 h-9" />
                        </Link>
                        {showUtilMenu &&
                            <>
                                <div className="hidden md:block fixed top-0 left-0 w-full h-full bg-black opacity-50 z-40" onClick={() => setShowUtilMenu(false)}></div>
                                <div className="hidden md:grid md:grid-cols-1 gap-2 absolute top-24 right-4 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-50">
                                    <Link href="/pdf">
                                        <button className="p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => { setShowUtilMenu(false); }}>
                                            <span className="kor">PDF 다운로드</span>
                                            <span className="eng">Download PDF</span>
                                        </button>
                                    </Link>
                                    {process.env.NEXT_PUBLIC_QNA_ENABLED == '1' &&
                                        <Link href="/question">
                                            <button className="p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => { setShowUtilMenu(false); }}>
                                                <span className="kor">질문 게시판</span>
                                                <span className="eng">Q&A</span>
                                            </button>
                                        </Link>
                                    }
                                    {process.env.NEXT_PUBLIC_PRINT_ENABLED == '1' &&
                                        <Link href="/print">
                                            <button className="p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => { setShowUtilMenu(false); }}>
                                                <span className="kor">인쇄 요청</span>
                                                <span className="eng">Print Request</span>
                                            </button>
                                        </Link>
                                    }
                                    <button className={`text-left p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3 ${isUnlockingPDF && 'text-gray-400'}`} disabled={isUnlockingPDF} onClick={e => {
                                        const file = document.createElement('input');
                                        file.type = 'file';
                                        file.accept = 'application/pdf';
                                        file.onchange = async () => {
                                            setIsUnlockingPDF(true);
                                            const formData = new FormData();
                                            formData.append('file', file.files![0]);
                                            const res = await fetch('/api/unlock_pdf', {
                                                method: 'POST',
                                                headers: { Authorization: account!.token! },
                                                body: formData
                                            });
                                            if (res.ok) {
                                                const data = await res.json();
                                                const dl = await fetch(data.path + '/' + data.dlName);
                                                const blob = await dl.blob();
                                                const a = document.createElement('a');
                                                a.href = URL.createObjectURL(blob);
                                                a.download = data.dlName;
                                                a.click();
                                                setIsUnlockingPDF(false);
                                            } else {
                                                const data = await res.json();
                                                alert(data.msg);
                                                setIsUnlockingPDF(false);
                                            }
                                        };
                                        file.click();
                                    }}>
                                        <span className="kor">PDF 잠금해제{isUnlockingPDF && ' 중...'}</span>
                                        <span className="eng">Unlock{isUnlockingPDF && 'ing'} PDF{isUnlockingPDF && '...'}</span>
                                    </button>
                                    {process.env.NEXT_PUBLIC_DISCORD_INVITE != null &&
                                        <a href={process.env.NEXT_PUBLIC_DISCORD_INVITE!}>
                                            <button className="p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => { setShowUtilMenu(false); }}>
                                                <span className="kor">Discord 서버</span>
                                                <span className="eng">Discord Server</span>
                                            </button>
                                        </a>
                                    }
                                </div>
                            </>
                        }
                        <button className="navbar-toggler md:hidden absolute top-0 right-0 mr-8 mt-7" onClick={e => { setShowMobileMenu(!showMobileMenu); }}>
                            {/*eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/menu.svg" alt="메뉴" width={24} height={24} className="kor dark:invert" />
                            {/*eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/menu.svg" alt="Menu" width={24} height={24} className="eng dark:invert" />
                        </button>
                        <div className={`${!showMobileMenu && "hidden"} fixed top-0 left-0 w-full h-full bg-black opacity-50 md:hidden z-40`} onClick={e => { setShowMobileMenu(false); }} />
                        <div className={`${!showMobileMenu && "hidden"} md:hidden h-[90%] fixed right-4 top-11 dark:bg-gray-800 mt-4 border border-gray-300 bg-white dark:border-gray-700 rounded-lg shadow-lg w-[35%] ml-auto mr-0 z-50`}>
                            <div className="grid grid-cols md:hidden grid-rows-[auto_1fr_auto] gap-2 w-[80%] ml-4 mr-4 mt-3 mb-3 z-20 h-full">
                                <div>
                                    <Link href="/pdf">
                                        <button className="w-full text-left p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => { setShowMobileMenu(false); }}>
                                            <span className="kor">PDF 다운로드</span>
                                            <span className="eng">Download PDF</span>
                                        </button>
                                    </Link>
                                    {process.env.NEXT_PUBLIC_QNA_ENABLED == '1' && account && account.token && isValidToken &&
                                        <Link href="/question">
                                            <button className="w-full text-left p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => { setShowMobileMenu(false); }}>
                                                <span className="kor">질문 게시판</span>
                                                <span className="eng">Q&A</span>
                                            </button>
                                        </Link>
                                    }
                                    {process.env.NEXT_PUBLIC_PRINT_ENABLED == '1' && account && account.token && isValidToken &&
                                        <Link href="/print">
                                            <button className="w-full text-left p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => { setShowMobileMenu(false); }}>
                                                <span className="kor">인쇄 요청</span>
                                                <span className="eng">Print Request</span>
                                            </button>
                                        </Link>
                                    }
                                    <button className={`w-full text-left p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3 ${isUnlockingPDF && 'text-gray-400'}`} disabled={isUnlockingPDF} onClick={e => {
                                        const file = document.createElement('input');
                                        file.type = 'file';
                                        file.accept = 'application/pdf';
                                        file.onchange = async () => {
                                            setIsUnlockingPDF(true);
                                            const formData = new FormData();
                                            formData.append('file', file.files![0]);
                                            const res = await fetch('/api/unlock_pdf', {
                                                method: 'POST',
                                                headers: { Authorization: account!.token! },
                                                body: formData
                                            });
                                            if (res.ok) {
                                                const data = await res.json();
                                                const dl = await fetch(data.path + '/' + data.dlName);
                                                const blob = await dl.blob();
                                                const a = document.createElement('a');
                                                a.href = URL.createObjectURL(blob);
                                                a.download = data.dlName;
                                                a.click();
                                                setIsUnlockingPDF(false);
                                            } else {
                                                const data = await res.json();
                                                alert(data.msg);
                                                setIsUnlockingPDF(false);
                                            }
                                        };
                                        file.click();
                                    }}>
                                        <span className="kor">PDF 잠금해제{isUnlockingPDF && ' 중...'}</span>
                                        <span className="eng">Unlock{isUnlockingPDF && 'ing'} PDF{isUnlockingPDF && '...'}</span>
                                    </button>
                                    {process.env.NEXT_PUBLIC_DISCORD_INVITE != null &&
                                        <a href={process.env.NEXT_PUBLIC_DISCORD_INVITE!}>
                                            <button className="w-full text-left p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring-3" onClick={() => { setShowUtilMenu(false); }}>
                                                <span className="kor">Discord 서버</span>
                                                <span className="eng">Discord Server</span>
                                            </button>
                                        </a>
                                    }
                                </div>
                                <div className="md:hidden" />
                                <Link href="/account" className="md:hidden w-full" onClick={e => { setShowMobileMenu(false); }}>
                                    <div className="grid grid-cols-[auto_1fr] mt-[-72px]">
                                        {/*eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/account.svg" alt="계정" width={24} height={24} className="kor w-[24px] h-[24px] dark:invert mr-2 md:hidden" />
                                        {/*eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/account.svg" alt="Account" width={24} height={24} className="eng w-[24px] h-[24px] dark:invert mr-2 md:hidden" />
                                        <span className="break-all">{account.id}</span>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </>
                    : <Link href="/login/id">
                        <button className="p-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3">
                            <span className="kor">로그인</span>
                            <span className="eng">Login</span>
                        </button>
                    </Link>
                }
            </header>
        </>
    );
}
