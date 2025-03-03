'use client';

import { formatDistanceStrict, formatDistanceToNowStrict } from "date-fns";
import { ko } from "date-fns/locale";
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkToc from 'remark-toc'
import rehypeSlug from 'rehype-slug'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { materialDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import Image from "next/image";
import Link from "next/link";

import { LSAccount } from "@/app/types";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

function ImageModal({ src, children, className }: { src: string, children: React.ReactNode, className?: string }) {
    const [displayed, setDisplayed] = useState(false);

    return (
        <div className={className}>
            <button className="block w-full" onClick={e => setDisplayed(true)}>
                {children}
            </button>
            {displayed &&
                <button className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-50" onClick={e => setDisplayed(false)}>
                    <div className="fixed top-[50%] left-[50%] transform translate-x-[-50%] translate-y-[-50%] z-50">
                        <Link href={src} target="_blank">
                            {(src.startsWith('/') && !src.startsWith('//'))
                                ? <Image src={src} alt={src} width={5000} height={5000} className="w-auto max-w-[90vw] max-h-screen" />
                                // eslint-disable-next-line @next/next/no-img-element
                                : <img src={src} alt={src} className="w-auto max-w-[90vw] max-h-screen" />
                            }
                        </Link>
                    </div>
                </button>
            }
        </div>
    );
}

export default function UpdatePrintReq(props: { params: Promise<{ idx: string }> }) {
    const params = use(props.params);
    const router = useRouter();

    const [titleKo, setTitleKo] = useState('');
    const [titleEn, setTitleEn] = useState('');
    const [commentKo, setCommentKo] = useState('');
    const [commentEn, setCommentEn] = useState('');
    const [lang, setLang] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [preview, setPreview] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        if (!account || !account.token) router.replace('/');
        else fetch(`/api/print/${params.idx}`, {
            method: 'GET',
            headers: {
                Authorization: account.token
            }
        }).then(response => {
            if (!response.ok) {
                router.replace('/');
            } else {
                response.json().then(data => {
                    setTitleKo(data.title_ko);
                    setTitleEn(data.title_en);
                    setCommentKo(data.comment_ko);
                    setCommentEn(data.comment_en);
                });
            }
        }).catch(() => {
            setIsOffline(true);
        })
    }, [params.idx, router, account]);
    useEffect(() => {
        fetch('/api/is_online').then(() => {
            setIsOffline(false);
        }).catch(() => {
            setIsOffline(true);
        });
    }, []);
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

    return (<>
        <div className="border-b-slate-400 border-b">
            <input type="text" autoFocus id="title" placeholder="제목" className="border border-slate-400 text-4xl rounded-lg p-4 w-[100%] dark:bg-[#424242]" value={lang == 1 ? titleEn : titleKo} onChange={e => {
                if (lang == 1) setTitleEn(e.currentTarget.value);
                else setTitleKo(e.currentTarget.value);
            }} />
            <br /><br />
        </div>
        <div>
            <br />
            <div className="kor">Discord, GitHub 등에서 사용하는 마크다운 문법이 적용됩니다.</div>
            <div className="eng">Markdown syntax used in Discord, GitHub, etc. is supported.</div>
            <br />
            <input type="checkbox" defaultChecked={false} id="preview" className="mr-2 h-4 w-4" onChange={e => {
                setPreview(e.currentTarget.checked);
            }} />
            <label htmlFor="preview" className="ml-2">
                <span className="kor">미리보기</span>
                <span className="eng">Preview</span>
            </label>
            <br />
            <label htmlFor="lang">언어{'('}Language{')'}: </label>
            <input type="radio" name="lang" id="lang_ko" className="ml-2 mr-2 h-4 w-4" onClick={() => { setLang(0); }} defaultChecked />한국어
            <input type="radio" name="lang" id="lang_en" className="ml-2 mr-2 h-4 w-4" onClick={() => { setLang(1); }} />English
            <br />
            {preview ?
                <div className="border border-slate-400 rounded-lg p-4 dark:bg-[#424242]">
                    <Markdown
                        remarkPlugins={[
                            [remarkGfm],
                            [remarkToc, { tight: true, ordered: true, prefix: '', heading: '(table[ -]of[ -])?contents?|toc|목차' }]]}
                        rehypePlugins={[rehypeSlug]} components={{
                            // @ts-ignore
                            code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || "");
                                return !inline && match ? (
                                    // @ts-ignore
                                    (<SyntaxHighlighter
                                        language={match[1]}
                                        PreTag="div"
                                        {...props}
                                        style={materialDark}
                                    >
                                        {String(children).replace(/\n$/, "")}
                                    </SyntaxHighlighter>)
                                ) : (
                                    <code {...props}>{children}</code>
                                );
                            },
                            img: (image) => (image.src && image.src.startsWith('/') && !image.src?.startsWith('//')) ? (
                                <ImageModal src={image.src || ""} className="w-full">
                                    <Image
                                        src={image.src || ""}
                                        alt={image.alt || ""}
                                        width={0}
                                        height={0}
                                        sizes="100vw"
                                        className="w-full object-cover"
                                    />
                                </ImageModal>
                            ) : (
                                <ImageModal src={image.src || ""} className="w-full">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={image.src || ""}
                                        alt={image.alt || ""}
                                        width={0}
                                        height={0}
                                        sizes="100vw"
                                        className="w-full object-cover"
                                    />
                                </ImageModal>
                            ),
                            a: (link) => (
                                <Link href={link.href || ""} rel="noopener noreferrer" target={(link.href || '').startsWith('#') ? '_top' : "_blank"}>{link.children}</Link>
                            ),
                            p({ children, ...props }) {
                                return <div {...props}>{children}</div>
                            }
                        }} className="prose dark:prose-invert">{lang == 1 ? commentEn : commentKo}</Markdown>
                </div>
                : <textarea rows={30} className="resize-none w-full" value={lang == 1 ? commentEn : commentKo} onChange={e => {
                    if (lang == 1) setCommentEn(e.currentTarget.value);
                    else setCommentKo(e.currentTarget.value);
                }}></textarea>}
        </div>
        <br />
        <button className="float-left ml-0 p-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring" disabled={isUploading} onClick={e => {
            e.preventDefault();
            document.getElementById('upload')?.click();
        }}>
            <span className="kor">{isUploading ? '업로드 중...' : '파일 업로드'}</span>
            <span className="eng">{isUploading ? 'Uploading...' : 'Upload File'}</span>
        </button>
        <input type="file" className="hidden" id="upload" onChange={e => {
            e.preventDefault();
            setIsUploading(true);
            const target = e.currentTarget;
            if (!target.files || target.files.length === 0) return;
            const file = target.files[0];
            const formData = new FormData();
            formData.append("file", file);
            fetch(`/api/upload`, {
                method: 'POST',
                headers: {
                    Authorization: account!.token!
                },
                body: formData
            }).then(response => {
                setIsUploading(false);
                e.target.value = '';
                if (response.ok) {
                    response.json().then(data => {
                        setCommentKo(commentKo + `${commentKo === '' ? '' : '\n'}` + `${file.type.startsWith('image/') ? '!' : ''}[파일 설명을 입력하세요](${data.path})`)
                        setCommentEn(commentEn + `${commentEn === '' ? '' : '\n'}` + `${file.type.startsWith('image/') ? '!' : ''}[Enter file description](${data.path})`)
                    })
                } else {
                    if (response.status === 413) {
                        if (deviceLang === 1) setErrorMsg(`The file size should be less than ${process.env.NEXT_PUBLIC_UPLOAD_LIMIT_MIB}MiB.`);
                        else setErrorMsg(`${process.env.NEXT_PUBLIC_UPLOAD_LIMIT_MIB}MiB 이하의 파일만 업로드할 수 있습니다.`);
                    } else {
                        response.json().then(data => {
                            setErrorMsg(data.msg);
                        });
                    }
                }
            });
        }} />
        <button className="float-right mr-0 p-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring" disabled={titleKo === '' || commentKo === '' || isOffline} onClick={e => {
            e.preventDefault();
            const target = e.currentTarget;
            target.disabled = true;
            if (!titleKo || !commentKo) return;
            fetch(`/api/print/${params.idx}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: account!.token!
                },
                body: JSON.stringify({
                    title: titleKo,
                    title_en: titleEn,
                    comment: commentKo,
                    comment_en: commentEn
                })
            }).then(response => {
                if (response.ok) router.push(`/print/${params.idx}`);
                else {
                    target.disabled = false;
                    response.json().then(data2 => {
                        setErrorMsg(data2.msg);
                    });
                }
            });
        }}>
            <span className="kor">{isOffline ? '오프라인' : '확인'}</span>
            <span className="eng">{isOffline ? 'Offline' : 'Submit'}</span>
        </button>
        {errorMsg !== '' && <p className="text-red-500">{errorMsg}</p>}
    </>);
}
