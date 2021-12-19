import React, {useState, useCallback, useEffect} from 'react'
import Modal from 'react-bootstrap/Modal'
import { FullScreen, useFullScreenHandle } from 'react-full-screen'
import Button from 'react-bootstrap/Button'
import Carousel from 'react-bootstrap/Carousel'
import VideoViewer from './VideoViewer'

import styles from './styles.module.css'

export default props => {

    const {tuuidSelectionne, fichiers, DEBUG} = props

    const handle = useFullScreenHandle()
    // const [fichiersFiltres, setFichiersFiltres] = useState('')
    const [afficherHeaderFooter, setAfficherHeaderFooter] = useState(true)
    const [nomFichier, setNomFichier] = useState('')
    const [downloadSrc, setDownloadSrc] = useState('')
    const [idxFichier, setIdxFichier] = useState('')
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

    const onSelect = useCallback(idx=>{
        const fichier = fichiers[idx]
        setNomFichier(fichier.nom)
        setIdxFichier(idx)
    }, [fichiers])

    const setDownloadSrcAction = useCallback(src=>{
        // console.debug("SET source download : %O", src)
        setDownloadSrc(src)
    }, [])

    const items = preparerItems({
        fichiers, 
        onClick, 
        setDownloadSrc: setDownloadSrcAction, 
        fullscreenHandle: handle, 
        idxCourant: idxFichier,
        DEBUG,
    })
    
    const defaultActiveIndex = fichiers.reduce((idxDefault, item, idx)=>{
        if(item.tuuid === tuuidSelectionne) return idx
        return idxDefault
    }, '')

    useEffect(()=>{
        const fichier = defaultActiveIndex!==''?fichiers[defaultActiveIndex]:''
        if(fichier) {
            setIdxFichier(defaultActiveIndex)
            setNomFichier(fichier.nom)
        } else if(defaultActiveIndex==='') {
            // Reset
            setIdxFichier('')
            setNomFichier('')
        }
    }, [defaultActiveIndex, fichiers])

    const downloadSrcClick = useCallback( event => {
        // https://www.delftstack.com/howto/javascript/javascript-download/
        // console.debug("Download %O", downloadSrc)
        // const url = window.URL.createObjectURL(new Blob([response.data], {type: 'video/mp4'}));
        const link = document.createElement('a')
        link.href = downloadSrc
        link.setAttribute('download', nomFichier)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [downloadSrc, nomFichier])

    const viewSrcClick = useCallback( event => {
        // console.debug("View %O", downloadSrc)
        const link = document.createElement('a')
        link.href = downloadSrc
        link.setAttribute('target', '_blank')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [downloadSrc, nomFichier])

    return (
        <Modal 
            variant="dark" 
            show={props.show && items?true:false} 
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
                    <Carousel 
                        className={styles['carousel-viewer']}
                        onSelect={onSelect}
                        defaultActiveIndex={defaultActiveIndex}
                        interval={null}
                        wrap={false}
                        indicators={false}
                        touch={false}
                        >
                        {items}
                    </Carousel>
                </FullScreen>
            </Modal.Body>

            {afficherHeaderFooter?
                <Modal.Footer>
                    {idxFichier+1} de {fichiers.length}
                </Modal.Footer>
                :''
            }

        </Modal>
    )
}

function preparerItems(props) {
    const {fichiers, onClick, idxCourant, setDownloadSrc, DEBUG} = props

    if(!fichiers || idxCourant==='') return ''  // Rien a faire

    return fichiers
        .map((item, idx)=>{
            // console.debug("Mapping fichier : %O", item)
            let Viewer = ''
            
            const mimetype = item.mimetype?item.mimetype.split(';').shift():''
            const mimetypeBase = mimetype.split('/').shift()
            if(mimetype === 'application/pdf') {
                if(idx >= idxCourant -1 && idx <= idxCourant + 1) {
                    Viewer = PreviewFile
                }
            } else if(mimetypeBase === 'image') {
                if(idx >= idxCourant -1 && idx <= idxCourant + 1) {
                    // Charger 1 index precedent et 2 suivants (4 images chargees a la fois)
                    Viewer = PreviewImage
                }
            } else if(mimetypeBase === 'video') {
                if(idx === idxCourant) {
                    Viewer = PreviewVideo
                } else if(idx >= idxCourant -1 && idx <= idxCourant + 1) {
                    // Permet de conserver l'image - force l'arret immediat du video sur switch
                    Viewer = PreviewImage
                }
            }

            return (
                <Carousel.Item key={item.tuuid}>
                    {Viewer?
                        <Viewer loader={item.loader} 
                                idxItem={idx}
                                idxCourant={idxCourant} 
                                mimetype={mimetype} 
                                onClick={onClick} 
                                setDownloadSrc={setDownloadSrc} 
                                DEBUG={DEBUG} />
                        :''
                    }
                </Carousel.Item>
            )
        })
}

function PreviewImage(props) {

    // console.debug("PreviewImage PROPPYS : %O", props)
    const {loader, onClick, setDownloadSrc, idxItem, idxCourant} = props

    const [srcThumbnail, setSrcThumbnail] = useState('')
    const [srcImage, setSrcImage] = useState('')
    const [err, setErr] = useState('')

    // Thumbnail
    useEffect(()=>{
        if(loader) {
            const {srcPromise, clean} = loader('thumbnail')
            srcPromise
                .then(src=>{
                    console.debug("Thumbnail charge : %O", src)
                    setSrcThumbnail(src)
                })
                .catch(err=>{
                    console.error("Erreur chargement thumbnail : %O", err)
                    // setErr(err)
                })
            return () => {
                clean()  // Executer sur exit
            }
        }
    }, [loader, setSrcThumbnail])

    // Image
    useEffect(()=>{
        if(loader) {
            const {srcPromise, clean} = loader('image')
            srcPromise
                .then(src=>{
                    setSrcImage(src)
                })
                .catch(err=>{
                    console.error("Erreur chargement image : %O", err)
                    setErr(err)
                })
            return () => {
                clean()  // Executer sur exit
            }
        }
    }, [loader, setSrcImage, setErr])

    useEffect(()=>{
        if(srcImage && idxItem === idxCourant) {
            setDownloadSrc(srcImage)
            // return () => {
            //     setDownloadSrc('')  // Cleanup bouton download
            // }
        }
    }, [srcImage, idxItem, idxCourant, setDownloadSrc])

    if(err) {
        return <p>Erreur de chargement : {''+err}</p>
    }

    if(!srcImage) {
        return (
            <div>
                <div>
                    {srcThumbnail?
                        <img src={srcThumbnail} />
                    :''}
                </div>
                <p>
                    <i className="fa fa-spinner fa-spin"/> ... Chargement en cours ...
                </p>
            </div>
        )
    }

    return (
        <img src={srcImage} onClick={onClick} />
    )
}

function PreviewVideo(props) {
    const { loader, onClick, setDownloadSrc, idxItem, idxCourant } = props

    const [srcImage, setSrcImage] = useState('')
    const [srcVideo, setSrcVideo] = useState('')
    const [message, setMessage] = useState(<p> <i className="fa fa-spinner fa-spin" />... Chargement en cours ...</p>)

    useEffect(()=>{
        if(loader) {
            const loaderImage = loader('thumbnail')
            // const loaderImage = loader('image')

            if(loaderImage && loaderImage.srcPromise) {
                const {srcPromise: srcImagePromise, clean: cleanImage} = loaderImage
                srcImagePromise
                    .then(src=>{
                        // console.debug("Image chargee : %O", src)
                        setSrcImage(src)
                    })
                    .catch(err=>{
                        console.error("Erreur chargement image : %O", err)
                        setMessage(''+err)
                    })
                return () => {
                    // Executer sur exit
                    // console.debug("Cleanup video (image)")
                    if(cleanImage) cleanImage()
                }
            }
        }
    }, [loader, setSrcImage, setSrcVideo])

    useEffect(()=>{
        if(loader && srcImage && idxItem === idxCourant) {
            const loaderVideo = loader('video')
            if(loaderVideo && loaderVideo.srcPromise) {
                setMessage(<p><i className="fa fa-spinner fa-spin"/> ... Loading ...</p>)
                // Charger video
                loaderVideo.srcPromise.then(src=>{
                    setSrcVideo(src)
                    setMessage('')
                }).catch(err=>{
                    console.error("Erreur chargement video : %O", err)
                    setMessage(''+err)
                })
                return () => {
                    // Executer sur exit
                    if(loaderVideo.clean) loaderVideo.clean()
                }
            } else {
                setMessage(<p> !!! Video non disponible !!! </p>)
            }
        }
    }, [loader, srcImage, idxItem, idxCourant, setSrcImage, setSrcVideo, setMessage])

    useEffect(()=>{
        if(srcVideo && idxItem === idxCourant) {
            setDownloadSrc(srcVideo)
            // return () => {
            //     setDownloadSrc('')  // Cleanup bouton download
            // }
        }
    }, [srcVideo, idxItem, idxCourant])

    if(srcVideo) {
        return (
            <VideoViewer src={srcVideo} poster={srcImage} />
        )
    }

    if(srcImage) {

        return (
            <div>
                <img src={srcImage} onClick={onClick} />
                <div>
                    {message}
                </div>
            </div>
        )
    }

    return (
        <div>{message}</div>
    )

}

function PreviewFile(props) {
    const { loader, mimetype, setDownloadSrc, idxItem, idxCourant } = props

    console.debug("PreviewFile proppys : %O", props)

    const [src, setSrc] = useState('')
    useEffect(()=>{
        if(loader) {
            const {srcPromise, clean} = loader('original')
            srcPromise
                .then(src=>{
                    setSrc(src)
                })
                .catch(err=>{console.error("Erreur chargement fichier : %O", err)})
            return () => {
                clean  // Executer sur exit
            }
        }
    }, [loader])

    useEffect(()=>{
        if(src && idxItem === idxCourant) {
            setDownloadSrc(src)
            // return () => {
            //     setDownloadSrc('')  // Cleanup bouton download
            // }
        }
    }, [src, idxItem, idxCourant])

    if(!src) return ''

    return (
        <object data={src} type={mimetype}>
            alt : <a href={src}>Ouvrir</a>
        </object>
    )
}