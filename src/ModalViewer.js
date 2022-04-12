import React, {useState, useCallback, useEffect} from 'react'
import Modal from 'react-bootstrap/Modal'
import { FullScreen, useFullScreenHandle } from 'react-full-screen'
import Button from 'react-bootstrap/Button'
import Carousel from 'react-bootstrap/Carousel'
import VideoViewer from './VideoViewer'

import styles from './styles.module.css'

function ModalViewer(props) {

    const {tuuidSelectionne, fichiers, DEBUG} = props

    const handle = useFullScreenHandle()
    const [afficherHeaderFooter, setAfficherHeaderFooter] = useState(true)
    const [downloadSrc, setDownloadSrc] = useState('')
    const [images, setImages] = useState('')
    const [item, setItem] = useState('')
    const [viewer, setViewer] = useState('ItemViewer')
    
    const onClick = useCallback(event=>{
        event.stopPropagation()
        setAfficherHeaderFooter(handle.active)
        if(!handle.active) {
            handle.enter(event)
        } else {
            handle.exit(event)
        }
    }, [handle])

    const handleCloseModal = useCallback(event=>{
        setAfficherHeaderFooter(true)
        if(handle.active) {
            handle.exit()  // Fermer full screen
            handle.active = false
        }
        props.handleClose(event)
    }, [handle])

    const onSelectCb = useCallback(idx=>{
        const fichier = images[idx]
        setItem(fichier)
    }, [images])

    const setDownloadSrcAction = setDownloadSrc  // useCallback(setDownloadSrc, [setDownloadSrc])

    // Calculer l'index de l'item a afficher dans le carousel
    useEffect(()=>{
        for(var idx=0; idx<fichiers.length; idx++) {
            const fichier = fichiers[idx]
            if(fichier && fichier.tuuid === tuuidSelectionne) {
                setItem(fichier)
                return
            }
        }

        // No match
        setItem('')
    }, [fichiers, tuuidSelectionne, setItem])

    // Conserver liste des images. Utilise par le carousel.
    useEffect(()=>{
        if(!fichiers) return setImages('')
        const images = fichiers.filter(item=>{
            if(!item) return false
            const mimetype = item.mimetype?item.mimetype.split(';').shift():''
            return mimetype.startsWith('image/')
        })
        setImages(images)
    }, [fichiers, setImages])

    useEffect(()=>{
        if(item && item.mimetype) {
            try {
                const mimetype = item.mimetype?item.mimetype.split(';').shift():''
                const mimetypeBase = mimetype.split('/').shift()
                if(mimetypeBase === 'image') {
                    setViewer('ImageCarousel')
                    return
                } 
            } catch(err) {
                console.debug("Erreur detection mimetype %O : %O", item, err)
            }
        }
        // Default
        setViewer('ItemViewer')
    }, [item, setViewer])

    const downloadSrcClick = useCallback( event => {
        // https://www.delftstack.com/howto/javascript/javascript-download/
        // console.debug("Download %O", downloadSrc)
        // const url = window.URL.createObjectURL(new Blob([response.data], {type: 'video/mp4'}));
        const link = document.createElement('a')
        link.href = downloadSrc
        link.setAttribute('download', item.nom)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [downloadSrc, item])

    const viewSrcClick = useCallback( event => {
        // console.debug("View %O", downloadSrc)
        const link = document.createElement('a')
        link.href = downloadSrc
        link.setAttribute('target', '_blank')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [downloadSrc])

    let Viewer
    switch(viewer) {
        case('ImageCarousel'): Viewer = ImageCarousel; break
        default: Viewer = ItemViewer
    }

    const nomFichier = item?item.nom:''

    return (
        <Modal 
            variant="dark" 
            show={props.show && item?true:false} 
            onHide={handleCloseModal} 
            fullscreen={true} 
            animation={false}
            className={styles['preview']}
            >

            {afficherHeaderFooter?
                <Modal.Header>
                    <Modal.Title>{nomFichier}</Modal.Title>
                    <div className={styles['modal-heading-buttons']}>
                        <Button variant="secondary" onClick={downloadSrcClick} disabled={!downloadSrc} title="Download" className={styles.accessoire}>
                            <i className="fa fa-download"/>
                        </Button>
                        <Button variant="secondary" onClick={viewSrcClick} disabled={!downloadSrc} title="View">
                            <i className="fa fa-window-maximize"/>
                        </Button>
                        <Button variant="secondary" onClick={handleCloseModal} title="View" className={styles.remove}>
                            <i className="fa fa-remove"/>
                        </Button>
                    </div>
                </Modal.Header>
                :''
            }

            <Modal.Body>
                <FullScreen handle={handle}>
                    <div className={styles['carousel-viewer']}>
                        <Viewer 
                            item={item} 
                            images={images} 
                            onSelect={onSelectCb}
                            onClick={onClick}
                            setDownloadSrc={setDownloadSrcAction} />
                    </div>
                </FullScreen>
            </Modal.Body>

        </Modal>
    )

}

export default ModalViewer

function ItemViewer(props) {
    // console.debug("ItemViewer proppies : %O", props)
    const {item, onClick, setDownloadSrc, DEBUG} = props

    // Par defaut show et preparer sont true (si params absent)
    const show = props.show === undefined?true:props.show
    const preparer = props.preparer === undefined?true:props.preparer

    if(!item) return <p>Aucunes donnees a afficher pour ce fichier.</p>  // Rien a faire

    try {
        // console.debug("Mapping fichier : %O", item)
        
        const mimetype = item.mimetype?item.mimetype.split(';').shift():''
        const mimetypeBase = mimetype.split('/').shift()

        // console.debug("Mimetype fichier : %O", mimetype)

        let Viewer = null
        if(mimetype === 'application/pdf') Viewer = PreviewFile
        else if(mimetypeBase === 'image') Viewer = PreviewImage
        else if(mimetypeBase === 'video') Viewer = PreviewVideo

        // console.debug("Type viewer selectionne : %O", Viewer)

        if(!Viewer) return <p>Format non supporte</p>

        // return <p>Allo2</p>

        return (
            <Viewer 
                item={item}
                show={show}
                preparer={preparer}
                onClick={onClick} 
                setDownloadSrc={setDownloadSrc} 
                DEBUG={DEBUG} />
        )
    } catch(err) {
        console.error("Erreur traitement ItemViewer: %O", err)
        return '' 
    }
}

function ImageCarousel(props) {
    // console.debug("ImageCarousel proppies : %O", props)

    const { images, item, onSelect, onClick, setDownloadSrc, DEBUG } = props

    const [defaultActiveIndex, setDefaultActiveIndex] = useState('')

    // console.debug("DefaultActiveIdx : %s", defaultActiveIndex)

    // Determiner idx de l'image selectionnee
    useEffect(()=>{
        setDownloadSrc('')  // Reset download src
        const tuuid = item.fileId
        for(let idx=0; idx<images.length; idx++) {
            const image = images[idx]
            if(image.fileId === tuuid) {
                return setDefaultActiveIndex(idx)
            }
        }
        setDefaultActiveIndex('')
    }, [images, item, setDownloadSrc])

    if(defaultActiveIndex === '') return ''

    return (
        <Carousel 
            className={styles['carousel-viewer']}
            onSelect={onSelect}
            defaultActiveIndex={defaultActiveIndex}
            interval={null}
            wrap={false}
            indicators={false}
            touch={false}>
            
            {images.map((item, idx)=>{
                const show = defaultActiveIndex === idx
                const preparer = idx >= defaultActiveIndex - 1 && idx <= defaultActiveIndex + 2
                return (
                    <Carousel.Item key={item.tuuid}>
                        <PreviewImage 
                            item={item} 
                            show={show}
                            preparer={preparer}
                            onClick={onClick} 
                            setDownloadSrc={setDownloadSrc} 
                            DEBUG={DEBUG} />
                    </Carousel.Item>
                )
            })}

        </Carousel>        
    )

}

// function preparerImages(props) {
//     const {fichiers, onClick, idxCourant, setDownloadSrc, DEBUG} = props

//     if(!fichiers || idxCourant==='') return ''  // Rien a faire

//     // Mapper les images seulement
//     return fichiers
//         .filter(item=>{
//             const mimetype = item.mimetype?item.mimetype.split(';').shift():''
//             if(!mimetype) return false
//             const mimetypeBase = mimetype.split(';').shift()
//             return mimetypeBase === 'image'
//         })
//         .map((item, idx)=>{
//             // console.debug("Mapping fichier : %O", item)
//             let Viewer = PreviewImage
            
//             if(mimetypeBase === 'image') {
//                 if(idx >= idxCourant -1 && idx <= idxCourant + 1) {
//                     // Charger 1 index precedent et 2 suivants (4 images chargees a la fois)
                    
//                 }
//             }

//             return (
//                 <Carousel.Item key={item.tuuid}>
//                     {Viewer?
//                         <Viewer loader={item.loader} 
//                                 idxItem={idx}
//                                 idxCourant={idxCourant} 
//                                 mimetype={mimetype} 
//                                 onClick={onClick} 
//                                 setDownloadSrc={setDownloadSrc} 
//                                 DEBUG={DEBUG} />
//                         :''
//                     }
//                 </Carousel.Item>
//             )
//         })
// }

function PreviewImage(props) {

    // console.debug("PreviewImage PROPPYS : %O", props)
    const { item, onClick, setDownloadSrc, preparer, show } = props
    const { imageLoader } = item

    // Show et preparer sont true si non defini dans les props
    if(show === undefined) show = true
    if(preparer === undefined) preparer = true
    const loadImage = show || preparer  // Togggle qui indique qu'on doit preparer l'image (utilise par useEffect)

    const [srcImage, setSrcImage] = useState('')
    const [complet, setComplet] = useState(false)
    const [err, setErr] = useState('')
    const [srcLocal, setSrcLocal] = useState('')

    useEffect(()=>{
        if(show && srcLocal) setDownloadSrc(srcLocal)
    }, [show, srcLocal, setDownloadSrc])

    // Load / unload
    useEffect(()=>{
        if(!imageLoader) return
        // console.debug("Utilisation loader : %O", loader)
        if(loadImage) {
            imageLoader.load(null, setSrcImage)
                .then(src=>{
                    setSrcLocal(src)
                    setSrcImage(src)
                })
                .catch(err=>{
                    console.error("Erreur load image : %O", err)
                    setErr(err)
                })
                .finally(()=>setComplet(true))
            return () => {
                imageLoader.unload()
                    .then(()=>{
                        setSrcImage('')
                        setComplet(false)
                    })
                    .catch(err=>console.warn("Erreur unload image : %O", err))
            }
        }
    }, [imageLoader, loadImage, setSrcImage, setErr, setComplet])

    return (
        <div>
            {err?
                <p>Erreur de chargement : {''+err}</p>
                :''
            }

            {srcImage?
                <img src={srcImage} onClick={onClick} />
                :''
            }
            
            {!complet?
                <p>
                        <i className="fa fa-spinner fa-spin"/> ... Chargement en cours ...
                </p>
                :''
            }
        </div>
    )
}

function PreviewVideo(props) {
    // const { loader, onClick, setDownloadSrc, idxItem, idxCourant } = props

    // const [srcImage, setSrcImage] = useState('')
    // const [srcVideo, setSrcVideo] = useState('')
    // const [message, setMessage] = useState(<p> <i className="fa fa-spinner fa-spin" />... Chargement en cours ...</p>)

    const { item, onClick, setDownloadSrc, preparer, show, erreurCb } = props
    const { videoLoader, imageLoader, mimetype } = item

    // Show et preparer sont true si non defini dans les props
    if(show === undefined) show = true
    if(preparer === undefined) preparer = true
    const loadFichier = show || preparer  // Togggle qui indique qu'on doit preparer l'image (utilise par useEffect)

    const [srcImage, setSrcImage] = useState('')
    const [complet, setComplet] = useState(false)
    const [srcLocal, setSrcLocal] = useState('')
    const [err, setErr] = useState('')
    const [selecteurVideo, setSelecteurVideo] = useState('')

    useEffect(()=>{
        if(show && srcLocal) setDownloadSrc(srcLocal)
    }, [show, srcLocal, setDownloadSrc])

    // Load / unload poster
    useEffect(()=>{
        if(!imageLoader) return
        // console.debug("Utilisation loader : %O", loader)
        if(loadFichier) {
            // Thumbnail / poster video
            imageLoader.load(null, setSrcImage)
                .then(setSrcImage)
                .catch(err=>{
                    console.warn("Erreur chargement thumbnail/poster : %O", err)
                })
            return () => {
                imageLoader.unload().catch(err=>console.debug("Erreur unload thumbnail : %O", err))
            }
        }
    }, [imageLoader, loadFichier, setSrcImage, setErr])

    useEffect(()=>{
        if(!videoLoader) return
        if(loadFichier) {
            // Thumbnail / poster video
            videoLoader.load(selecteurVideo)
                .then(setSrcLocal)
                .catch(err=>{
                    console.error("Erreur chargement video : %O", err)
                    setErr(err)
                })
                .finally(()=>{
                    setComplet(true)
                })
            return () => {
                imageLoader.unload().catch(err=>console.debug("Erreur unload video : %O", err))
                setSrcImage('')
                setSrcLocal('')
                setComplet(false)
            }
        }

    }, [videoLoader, loadFichier, setSrcImage, setSrcLocal, setComplet, setErr])

    return (
        <div>
            {err?
                <p>Erreur de chargement : {''+err}</p>
                :''
            }

            {complet?
                <VideoViewer src={srcLocal} poster={srcImage} />
            :(
                <div>
                    {srcImage?
                        <img src={srcImage} />
                        :''
                    }
                    <p>
                            <i className="fa fa-spinner fa-spin"/> ... Chargement en cours ...
                    </p>
                </div>
            )}
        </div>
    )

    // useEffect(()=>{
    //     if(loader) {
    //         const loaderImage = loader('thumbnail')
    //         // const loaderImage = loader('image')

    //         if(loaderImage && loaderImage.srcPromise) {
    //             const {srcPromise: srcImagePromise, clean: cleanImage} = loaderImage
    //             srcImagePromise
    //                 .then(src=>{
    //                     // console.debug("Image chargee : %O", src)
    //                     setSrcImage(src)
    //                 })
    //                 .catch(err=>{
    //                     console.error("Erreur chargement image : %O", err)
    //                     setMessage(''+err)
    //                 })
    //             return () => {
    //                 // Executer sur exit
    //                 // console.debug("Cleanup video (image)")
    //                 if(cleanImage) cleanImage()
    //             }
    //         }
    //     }
    // }, [loader, setSrcImage, setSrcVideo])

    // useEffect(()=>{
    //     if(loader && srcImage && idxItem === idxCourant) {
    //         const loaderVideo = loader('video')
    //         if(loaderVideo && loaderVideo.srcPromise) {
    //             setMessage(<p><i className="fa fa-spinner fa-spin"/> ... Loading ...</p>)
    //             // Charger video
    //             loaderVideo.srcPromise.then(src=>{
    //                 setSrcVideo(src)
    //                 setMessage('')
    //             }).catch(err=>{
    //                 console.error("Erreur chargement video : %O", err)
    //                 setMessage(''+err)
    //             })
    //             return () => {
    //                 // Executer sur exit
    //                 if(loaderVideo.clean) loaderVideo.clean()
    //             }
    //         } else {
    //             setMessage(<p> !!! Video non disponible !!! </p>)
    //         }
    //     }
    // }, [loader, srcImage, idxItem, idxCourant, setSrcImage, setSrcVideo, setMessage])

    // useEffect(()=>{
    //     if(srcVideo && idxItem === idxCourant) {
    //         setDownloadSrc(srcVideo)
    //         // return () => {
    //         //     setDownloadSrc('')  // Cleanup bouton download
    //         // }
    //     }
    // }, [srcVideo, idxItem, idxCourant])

    // if(srcVideo) {
    //     return (
    //         <VideoViewer src={srcVideo} poster={srcImage} />
    //     )
    // }

    // if(srcImage) {

    //     return (
    //         <div>
    //             <img src={srcImage} onClick={onClick} />
    //             <div>
    //                 {message}
    //             </div>
    //         </div>
    //     )
    // }

    // return (
    //     <div>{message}</div>
    // )

}

function PreviewFile(props) {
    const { item, onClick, setDownloadSrc, preparer, show, erreurCb } = props
    const { loader, mimetype } = item
    const { thumbnail } = item || {}
    const { smallLoader } = thumbnail

    // Show et preparer sont true si non defini dans les props
    if(show === undefined) show = true
    if(preparer === undefined) preparer = true
    const loadFichier = show || preparer  // Togggle qui indique qu'on doit preparer l'image (utilise par useEffect)

    const [srcThumbnail, setSrcThumbnail] = useState('')
    const [complet, setComplet] = useState(false)
    const [srcLocal, setSrcLocal] = useState('')
    const [err, setErr] = useState('')

    useEffect(()=>{
        if(show && srcLocal) setDownloadSrc(srcLocal)
    }, [show, srcLocal, setDownloadSrc])

    // Load / unload
    useEffect(()=>{
        if(!loader) return
        // console.debug("Utilisation loader : %O", loader)
        if(loadFichier) {
            // Thumbnail / poster video
            if(smallLoader) {
                smallLoader.load(null, {setFirst: setSrcThumbnail})
                    .then(setSrcThumbnail)
                    .catch(err=>{
                        console.warn("Erreur chargement thumbnail : %O", err)
                    })
            }

            // Loader fichier source (original)
            loader.load()
                .then(src=>setSrcLocal(src))
                .catch(err=>{
                    console.error("Erreur load fichier : %O", err)
                    setErr(err)
                })
                .finally(()=>setComplet(true))

            return () => {
                if(smallLoader) smallLoader.unload().catch(err=>console.debug("Erreur unload thumbnail : %O", err))
                loader.unload()
                    .then(()=>{
                        setSrcThumbnail('')
                        setSrcLocal('')
                        setComplet(false)
                        setErr('')
                    })
                    .catch(err=>console.warn("Erreur unload fichier : %O", err))
            }
        }
    }, [loader, loadFichier, setSrcLocal, setSrcThumbnail, setErr, setComplet])

    return (
        <div>
            {err?
                <p>Erreur de chargement : {''+err}</p>
                :''
            }

            {srcLocal?
                <object data={srcLocal} type={mimetype}>
                    alt : <a href={srcLocal}>Ouvrir</a>
                </object>
                :
                ''
            }
            
            {!complet?(
                <div>
                    {srcThumbnail?
                        <img src={srcThumbnail} />
                        :''
                    }
                    <p>
                            <i className="fa fa-spinner fa-spin"/> ... Chargement en cours ...
                    </p>
                </div>
            ):''}
        </div>
    )

}