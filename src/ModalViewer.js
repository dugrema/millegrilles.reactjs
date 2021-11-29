import React, {useState, useCallback, useEffect} from 'react'
import Modal from 'react-bootstrap/Modal'
import { FullScreen, useFullScreenHandle } from 'react-full-screen'
import Button from 'react-bootstrap/Button'
import Carousel from 'react-bootstrap/Carousel'
// import VideoViewer from './VideoViewer'

import styles from './styles.module.css'

export default props => {

    const {tuuidSelectionne, fichiers} = props

    const handle = useFullScreenHandle()
    const [fichiersFiltres, setFichiersFiltres] = useState('')
    const [afficherHeaderFooter, setAfficherHeaderFooter] = useState(true)
    const [nomFichier, setNomFichier] = useState('')
    const [downloadSrc, setDownloadSrc] = useState('')
    const [idxFichier, setIdxFichier] = useState(0)
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
        const fichier = fichiersFiltres[idx]
        setNomFichier(fichier.nom)
        setIdxFichier(idx)
    }, [fichiersFiltres])

    const setDownloadSrcAction = useCallback(src=>{
        console.debug("SET source download : %O", src)
        setDownloadSrc(src)
    }, [])

    const items = preparerItems({
        fichiers: fichiersFiltres, 
        onClick, 
        setDownloadSrc: setDownloadSrcAction, 
        fullscreenHandle: handle, 
        idxCourant: idxFichier
    })
    
    const defaultActiveIndex = fichiers.reduce((idxDefault, item, idx)=>{
        if(item.tuuid === tuuidSelectionne) return idx
        return idxDefault
    }, 0)

    useEffect(()=>{
        // Filtrer la liste des fichiers pour conserver types supportes durant navigation
        const fichiersFiltres = fichiers.filter(item=>{
            // Conserver les types supportes (pdf, image ou video)
            const mimetype = item.mimetype?item.mimetype.split(';').shift():''
            const mimetypeBase = mimetype.split('/').shift()
            return mimetype === 'application/pdf' || mimetypeBase === 'video' || mimetypeBase === 'image'
        })
        setFichiersFiltres(fichiersFiltres)

        // Utiliser liste non filtree pour fichier initial, faire un match par tuuid sur la liste filtree
        const fichier = fichiers[defaultActiveIndex]
        const indexAjuste = fichiersFiltres.reduce((idxTrouve, item, idx)=>{
            if(item.tuuid === fichier.tuuid) return idx
            return idxTrouve
        }, -1)
        if(fichier) {
            setIdxFichier(indexAjuste)
            setNomFichier(fichier.nom)
        }
    }, [defaultActiveIndex, fichiers, tuuidSelectionne])

    const downloadSrcClick = useCallback( event => {
        // https://www.delftstack.com/howto/javascript/javascript-download/
        console.debug("Download %O", downloadSrc)
        // const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a')
        link.href = downloadSrc
        link.setAttribute('download', nomFichier)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [downloadSrc, nomFichier])

    const viewSrcClick = useCallback( event => {
        console.debug("View %O", downloadSrc)
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
            show={props.show} 
            onHide={handleCloseModal} 
            fullscreen={true} 
            animation={false}
            className={styles['preview']}
            >

            {afficherHeaderFooter?
                <Modal.Header closeButton>
                    <Modal.Title>{nomFichier}</Modal.Title>
                    <Button variant="secondary" onClick={downloadSrcClick} disabled={!downloadSrc} title="Download">
                        <i className="fa fa-download"/>
                    </Button>
                    <Button variant="secondary" onClick={viewSrcClick} disabled={!downloadSrc} title="View">
                        <i className="fa fa-window-maximize"/>
                    </Button>
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
                    {idxFichier+1} de {fichiersFiltres.length}
                </Modal.Footer>
                :''
            }

        </Modal>
    )
}

function preparerItems(props) {
    const {fichiers, onClick, idxCourant, setDownloadSrc} = props

    if(!fichiers) return ''  // Rien a faire

    return fichiers
        .map((item, idx)=>{
            console.debug("Mapping fichier : %O", item)
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
                                setDownloadSrc={setDownloadSrc} />
                        :''
                    }
                </Carousel.Item>
            )
        })
}

function PreviewImage(props) {

    console.debug("PreviewImage PROPPYS : %O", props)
    const {loader, onClick, setDownloadSrc, idxItem, idxCourant} = props

    const [srcImage, setSrcImage] = useState('')
    useEffect(()=>{
        if(loader) {
            const {srcPromise, clean} = loader('image')
            srcPromise
                .then(src=>{
                    setSrcImage(src)
                })
                .catch(err=>{console.error("Erreur chargement image : %O", err)})
            return () => {
                clean()  // Executer sur exit
            }
        }
    }, [loader])

    useEffect(()=>{
        if(srcImage && idxItem === idxCourant) {
            setDownloadSrc(srcImage)
            // return () => {
            //     setDownloadSrc('')  // Cleanup bouton download
            // }
        }
    }, [srcImage, idxItem, idxCourant, setDownloadSrc])

    return (
        <img src={srcImage} onClick={onClick} />
    )
}

function PreviewVideo(props) {
    const { loader, onClick, setDownloadSrc, idxItem, idxCourant } = props

    const [srcImage, setSrcImage] = useState('')
    const [srcVideo, setSrcVideo] = useState('')

    useEffect(()=>{
        if(loader) {
            const {srcPromise: srcImagePromise, clean: cleanImage} = loader('image')
            srcImagePromise
                .then(src=>{
                    console.debug("Image chargee : %O", src)
                    setSrcImage(src)
                })
                .catch(err=>{console.error("Erreur chargement image : %O", err)})
            return () => {
                // Executer sur exit
                console.debug("Cleanup video (image)")
                if(cleanImage) cleanImage()
            }
        }
    }, [loader, setSrcImage, setSrcVideo])

    useEffect(()=>{
        if(loader && srcImage && idxItem === idxCourant) {
            const {srcPromise: srcVideoPromise, clean: cleanVideo} = loader('video')
            // Charger video
            srcVideoPromise.then(src=>{
                console.debug("Video charge : %O", src)
                setSrcVideo(src)
            }).catch(err=>{console.error("Erreur chargement video : %O", err)})
            return () => {
                // Executer sur exit
                console.debug("Cleanup video")
                if(cleanVideo) cleanVideo()
            }
        }
    }, [loader, srcImage, idxItem, idxCourant, setSrcImage, setSrcVideo])

    useEffect(()=>{
        if(srcVideo && idxItem === idxCourant) {
            setDownloadSrc(srcVideo)
            // return () => {
            //     setDownloadSrc('')  // Cleanup bouton download
            // }
        }
    }, [srcVideo, idxItem, idxCourant])

    if(srcVideo) {
        throw new Error("fix me")
        // return (
        //     <VideoViewer src={srcVideo} poster={srcImage} />
        // )
    }

    if(srcImage) {
        return (
            <div>
                <img src={srcImage} onClick={onClick} />
                <i className="fa fa-spinner fa-spin"/> ... Loading ...
            </div>
        )
    }

    return ''

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