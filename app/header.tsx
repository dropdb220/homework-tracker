'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';

import type { LSAccount } from './types';

export default function Header() {
    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [isValidToken, setIsValidToken] = useState(false);
    const [showUtilMenu, setShowUtilMenu] = useState(false);
    const [isUnlockingPDF, setIsUnlockingPDF] = useState(false);

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
                } else {
                    setIsValidToken(false);
                    setAccount(null);
                }
            }).catch(() => {
                setIsValidToken(true);
            });
        }
    }, [account, setAccount]);

    return (
        <>
            <header className={`sticky w-full grid grid-cols-[auto_1fr_auto${(process.env.NEXT_PUBLIC_QNA_ENABLED == '1' && account && account.token && isValidToken) ? '_auto' : ''}] p-4 h-24`}>
                <Link href="/" className="grid grid-cols-[auto_auto]">
                    <Image src="/icon3.png" alt={process.env.NEXT_PUBLIC_TITLE || '숙제 트래커'} width={48} height={48} className="h-12 w-12" />
                    <div className="grid grid-rows-[1fr_auto_1fr] h-12">
                        <div></div>
                        <span className="ml-2 text-3xl font-semibold">{process.env.NEXT_PUBLIC_TITLE || '숙제 트래커'}</span>
                        <div></div>
                    </div>
                </Link>
                <div className="grid-cols-[auto_1fr_auto_auto]"></div>
                {account && account.token && isValidToken &&
                    <button className="h-9" onClick={e => {
                        setShowUtilMenu(!showUtilMenu);
                        e.preventDefault();
                    }}>
                        <Image src="/menu.svg" alt="질문" width={36} height={36} className="dark:invert mr-2 mt-1.5 mb-1.5 h-9" />
                    </button>
                }
                {account && account.token && isValidToken
                    ? <Link href="/account">
                        <Image src="/account.svg" alt="계정" width={36} height={36} className="dark:invert mr-2 mt-1.5 mb-1.5 h-9" />
                    </Link>
                    : <Link href="/login/id">
                        <button className="mr-2 p-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring">로그인</button>
                    </Link>
                }
            </header>
            {showUtilMenu &&
                <>
                    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-10" onClick={() => setShowUtilMenu(false)}></div>
                    <div className="grid grid-cols-1 gap-2 absolute top-24 right-4 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-10">
                        {process.env.NEXT_PUBLIC_QNA_ENABLED == '1' && account && account.token && isValidToken &&
                            <Link href="/question">
                                <button className="p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring" onClick={() => { setShowUtilMenu(false); }}>질문 게시판</button>
                            </Link>
                        }
                        <button className={`p-2 rounded-lg bg-white dark:bg-gray-800 dark:hover:bg-gray-700 hover:bg-gray-200 transition-all ease-in-out duration-200 focus:ring ${isUnlockingPDF && 'text-gray-400'}`} disabled={isUnlockingPDF} onClick={e => {
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
                        }}>PDF 잠금해제{isUnlockingPDF && ' 중...'}</button>
                    </div>
                </>
            }
        </>
    );
}