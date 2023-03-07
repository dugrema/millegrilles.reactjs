import React, {useState, useCallback, useEffect, useMemo} from 'react'
import Modal from 'react-bootstrap/Modal'
import { FullScreen, useFullScreenHandle } from 'react-full-screen'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Carousel from 'react-bootstrap/Carousel'
import VideoViewer from './VideoViewer'
import { useDetecterSupport } from './detecterAppareils'

// import styles from './styles.module.css'

function ModalViewer(props) {

    // console.debug("ModalViewer props : %O", props)

    const {tuuidSelectionne, fichiers, DEBUG} = props

    const support = useDetecterSupport()

    const handle = useFullScreenHandle()
    const [afficherHeaderFooter, setAfficherHeaderFooter] = useState(true)
    const [downloadSrc, setDownloadSrc] = useState('')
    // const [images, setImages] = useState('')
    const [item, setItem] = useState('')
    const [viewer, setViewer] = useState('ItemViewer')
    const [showButtons, setShowButtons] = useState(true)
    
    // Conserver liste des images. Utilise par le carousel.
    const images = useMemo(()=>{
        if(!fichiers) return ''
        return fichiers.filter(item=>{
            if(!item) return false
            const mimetype = item.mimetype?item.mimetype.split(';').shift():''
            return mimetype.startsWith('image/')
        })
    }, [fichiers])

    const toggleShowButtons = useCallback(()=>{
        setShowButtons(!showButtons)
    }, [showButtons, setShowButtons])

    const onClick = useCallback(event=>{
        event.stopPropagation()
        event.preventDefault()

        if(support.fullscreen) {
            setAfficherHeaderFooter(handle.active)
            if(!handle.active) {
                handle.enter(event)
            } else {
                handle.exit(event)
            }
        } else {
            toggleShowButtons()
        }
    }, [handle, support, toggleShowButtons])

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

    const setDownloadSrcAction = setDownloadSrc

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
            className='preview'
            >

            <Modal.Body>
                <FullScreen handle={handle}>
                    <div className='carousel-viewer'>
                    
                        <Viewer 
                            item={item} 
                            images={images} 
                            onSelect={onSelectCb}
                            onClick={onClick}
                            setDownloadSrc={setDownloadSrcAction} />
                        
                        {showButtons?
                            <div className='info'>
                                <p><span className='titre'>{nomFichier}</span></p>
                                <Button 
                                    variant="secondary" 
                                    onClick={downloadSrcClick} 
                                    disabled={!downloadSrc} 
                                    title="Download" 
                                    className='accessoire'>
                                    <i className="fa fa-download"/>
                                </Button>
                                <Button variant="secondary" onClick={viewSrcClick} disabled={!downloadSrc} title="View">
                                    <i className="fa fa-window-maximize"/>
                                </Button>
                                <Button variant="secondary" onClick={handleCloseModal} title="View" className='remove'>
                                    <i className="fa fa-remove"/>
                                </Button>
                            </div>
                            :''
                        }
                    
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
    let show = !!props.show,
        preparer = !!props.preparer || show

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

        // console.debug("Viewer isSingle : %s", Viewer.isSingle)
        if(Viewer.prototype.isSingle) {
            show = true
            preparer = true
        }

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

    const imagesCarousel = useMemo(
        ()=>preparerItemsCarousel(images, defaultActiveIndex, onClick, setDownloadSrc, (DEBUG)), 
        [images, defaultActiveIndex, onClick, setDownloadSrc, DEBUG]
    )

    if(defaultActiveIndex === '') return ''

    return (
        <Carousel 
            className='carousel-viewer'
            onSelect={onSelect}
            defaultActiveIndex={defaultActiveIndex}
            interval={null}
            wrap={false}
            indicators={false}
            touch={false}>
            
            {imagesCarousel}

        </Carousel>        
    )

}

function preparerItemsCarousel(images, defaultActiveIndex, onClick, setDownloadSrc, opts) {
    // console.debug("!!! preparerItemsCarousel, images %O, defaultActiveIndex %s", images, defaultActiveIndex)
    opts = opts || {}
    const DEBUG = opts.DEBUG || false

    return images.map((item, idx)=>{
        const itemId = item.fileId||item.tuuid||item.fuuid
        const show = defaultActiveIndex === idx
        const preparer = idx >= defaultActiveIndex - 1 && idx <= defaultActiveIndex + 2

        return (
            <Carousel.Item key={itemId}>
                <PreviewImage 
                    item={item} 
                    show={show}
                    preparer={preparer}
                    onClick={onClick} 
                    setDownloadSrc={setDownloadSrc} 
                    DEBUG={DEBUG} />
            </Carousel.Item>            
        )
    })
}

function PreviewImage(props) {

    // console.debug("PreviewImage PROPPYS : %O", props)
    // console.debug("PreviewImage tuuid : %O", props.tuuid)
    const { item, onClick, setDownloadSrc, preparer, show } = props
    const { imageLoader } = item
    const version_courante = item.version_courante || {},
          anime = version_courante.anime?true:false

    // Show et preparer sont true si non defini dans les props
    if(show === undefined) show = true
    if(preparer === undefined) preparer = true
    const loadImage = show || preparer  // Togggle qui indique qu'on doit preparer l'image (utilise par useEffect)

    const [srcImage, setSrcImage] = useState('')
    const [complet, setComplet] = useState(false)
    const [err, setErr] = useState('')
    const [srcLocal, setSrcLocal] = useState('')

    useEffect(()=>{
        if(show) {
            if(srcLocal) setDownloadSrc(srcLocal)
            if(anime) setSrcImage(srcLocal)
        } else if(anime) {
            // Reset image, redemarre l'animation lors de l'affichage
            setSrcImage('')
        }
    }, [show, srcLocal, anime, setDownloadSrc, setSrcImage])

    // Load / unload
    useEffect(()=>{
        // console.debug("!!!PreviewImage loadImage : %O", loadImage)
        if(!imageLoader) return
        // console.debug("Utilisation loader pour image %O", imageLoader)
        const label = anime?'original':null
        if(loadImage) {
            // console.debug("!!! load image anime: %s, imageLoader: %O, loadImage: %s", anime, imageLoader, loadImage)
            imageLoader.load(label, setSrcImage, {erreurCb: setErr})
                .then(src=>{
                    setSrcLocal(src)
                    if(!anime) {
                        setSrcImage(src)
                    }
                })
                .catch(err=>{
                    console.error("Erreur load image : %O", err)
                    setErr(err)
                })
                .finally(()=>setComplet(true))
            return () => {
                // console.debug("!!! unload image anime: %s, imageLoader: %O, loadImage: %s", anime, imageLoader, loadImage)
                imageLoader.unload()
                    .then(()=>{
                        setSrcImage('')
                        setComplet(false)
                    })
                    .catch(err=>console.warn("Erreur unload image : %O", err))
            }
        }
    }, [anime, imageLoader, loadImage, setSrcImage, setErr, setComplet])

    return (
        <div>
            <Alert variant="danger" show={err?true:false}>
                <Alert.Heading>Erreur chargement de l'image</Alert.Heading>
                Erreur de chargement : {err.message?err.message:''+err}
            </Alert>

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
                .then(srcLocal => {
                    setSrcLocal(srcLocal)
                })
                .catch(err=>{
                    console.error("Erreur chargement video : %O", err)
                    setErr(err)
                })
                .finally(()=>{
                    setComplet(true)
                })
            return () => {
                setSrcImage('')
                setSrcLocal('')
                setComplet(false)
                try {
                    imageLoader.unload().catch(err=>console.debug("Erreur unload video : %O", err))
                } catch(err) {
                    console.error("Erreur imageLoader.unload() : %O", err)
                }
            }
        }

    }, [videoLoader, loadFichier, setSrcImage, setSrcLocal, setComplet, setErr])

    return (
        <div>
            <Alert variant="danger" show={err?true:false}>Erreur de chargement : {''+err}</Alert>

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

}
PreviewVideo.prototype.isSingle = true

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
            <Alert variant="danger" show={err?true:false}>Erreur de chargement : {''+err}</Alert>

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
PreviewFile.prototype.isSingle = true