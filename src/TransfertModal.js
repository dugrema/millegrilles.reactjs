import React, { useState, useEffect, useCallback } from 'react'
import { proxy } from 'comlink'
import Modal from 'react-bootstrap/Modal'
import Badge from 'react-bootstrap/Badge'
import Alert from 'react-bootstrap/Alert'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import ProgressBar from 'react-bootstrap/ProgressBar'
import { AlertTimeout } from './Alerts'

import styles from './styles.module.css'

const ETAT_PREPARATION = 1,
      ETAT_PRET = 2,
      ETAT_UPLOADING = 3,
      ETAT_COMPLETE = 4,
      ETAT_ECHEC = 5,
      ETAT_CONFIRME = 6,
      ETAT_UPLOAD_INCOMPLET = 7

const CONST_ETATS_DOWNLOAD = {
    ETAT_PRET: 1,
    ETAT_EN_COURS: 2,
    ETAT_SUCCES: 3,
    ETAT_ECHEC: 4
}

function TransfertModal(props) {

    const { 
        workers, erreurCb, isEtatUploadExterne, etatUploadExterne,
        uploads, progresUpload, downloads, progresDownload,
        continuerUploads, supprimerUploads,
        continuerDownloads, supprimerDownloads,
    } = props
    const { transfertFichiers } = workers

    // const [etatDownload, setEtatDownload] = useState({})
    // const [etatUpload, setEtatUpload] = useState({})
    const [errDownload, setErrDownload] = useState('')
    const [errUpload, setErrUpload] = useState('')

    // // Transferer etat transfert global
    // useEffect(()=>{
    //     // console.debug("Transfert update\nDownload : %O\nUpload: %O", etatDownload, etatUpload)
    //     setEtatTransfert({download: etatDownload, upload: etatUpload})
    // }, [setEtatTransfert, etatDownload, etatUpload])

    // Importer les evenements d'upload (geres a l'externe du module)
    // useEffect(()=>{
    //     if(isEtatUploadExterne && etatUploadExterne) {
    //         // etatUploadExterne = {nbFichiersPending, pctFichierEnCours, ...flags}
    //         handleUploadUpdate(transfertFichiers, etatUploadExterne, setEtatUpload)            
    //     }
    // }, [isEtatUploadExterne, etatUploadExterne, transfertFichiers, setEtatUpload])

    // Entretien idb/cache de fichiers
    // useEffect(()=>{
    //     if(!transfertFichiers) return 
    //     try {
    //         // erreurCb(`Transfert fichiers etat : ${transfertFichiers.down_entretienCache !== null}`)
    //         let intervalId = null
    //         transfertFichiers.down_entretienCache()
    //             .then(()=>{
    //                 intervalId = setInterval(()=>{transfertFichiers.down_entretienCache().catch(erreurCb)}, 300000)
    //             })
    //             .catch(erreurCb)

    //         const proxySetEtatDownload = proxy((pending, pct, flags)=>{
    //             flags = flags || {}
    //             // console.debug("Set nouvel etat download. pending:%d, pct:%d, flags: %O", pending, pct, flags)
    //             handleDownloadUpdate(transfertFichiers, {pending, pct, ...flags}, setEtatDownload)
    //         })
    //         transfertFichiers.down_setCallbackDownload(proxySetEtatDownload).catch(erreurCb)

    //         // Faire premiere maj
    //         handleDownloadUpdate(transfertFichiers, {}, setEtatDownload).catch(erreurCb)

    //         // if(!isEtatUploadExterne) {
    //         //     const proxySetEtatUpload = proxy((nbFichiersPending, pctFichierEnCours, flags)=>{
    //         //         flags = flags || {}
    //         //         handleUploadUpdate(transfertFichiers, {nbFichiersPending, pctFichierEnCours, ...flags}, setEtatUpload)
    //         //     })
    //         //     transfertFichiers.up_setCallbackUpload(proxySetEtatUpload).catch(erreurCb)
    //         // } else {
    //         //     console.info("Hook avec etatUploadExterne")
    //         // }

    //         return () => {
    //             if(intervalId) {
    //                 clearInterval(intervalId)
    //                 transfertFichiers.down_entretienCache().catch(erreurCb)
    //             }
    //         }
    //     } catch(err) {
    //         erreurCb(err, 'Erreur chargement transfert modal')
    //     }
    // }, [transfertFichiers, isEtatUploadExterne, erreurCb])

    return (
        <Modal 
            show={props.show} 
            onHide={props.fermer}
            size="lg">

            <Modal.Header closeButton>
                <Modal.Title>
                    Transfert de fichiers
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                <Row>
                    <Col xs={12} lg={6}>
                        <TabDownload 
                            workers={workers}
                            downloads={downloads}
                            progres={progresDownload}
                            errDownload={errDownload} 
                            setErrDownload={setErrDownload} 
                            continuerDownloads={continuerDownloads}
                            supprimerDownloads={supprimerDownloads} />
                    </Col>
                    <Col xs={12} lg={6}>
                        <TabUpload 
                            workers={workers} 
                            uploads={uploads}
                            progresUpload={progresUpload}
                            errUpload={errUpload}
                            setErrUpload={setErrUpload} 
                            continuerUploads={continuerUploads}
                            supprimerUploads={supprimerUploads} />
                    </Col>
                </Row>
            </Modal.Body>

        </Modal>
    )

}

export default TransfertModal

function TabDownload(props) {
    const {workers, downloads, progresDownload, errDownload, setErrDownload, continuerDownloads, supprimerDownloads} = props
    return (
        <div>
            <AlertTimeout variant="danger" value={errDownload} setValue={setErrDownload} delay={20000} titre="Erreur durant download" />
            <EtatDownload 
                workers={workers} 
                downloads={downloads} 
                progres={progresDownload} 
                erreurCb={setErrDownload} 
                continuerDownloads={continuerDownloads}
                supprimerDownloads={supprimerDownloads}
             />
        </div>
    )
}

function TabUpload(props) {
    const {workers, uploads, progresUpload, errUpload, setErrUpload, continuerUploads, supprimerUploads} = props
    return (
        <div>
            <AlertTimeout variant="danger" value={errUpload} setValue={setErrUpload} delay={20000} titre="Erreur durant upload" />
            <EtatUpload 
                workers={workers} 
                uploads={uploads} 
                progresUpload={progresUpload} 
                erreurCb={setErrUpload} 
                continuerUploads={continuerUploads}
                supprimerUploads={supprimerUploads}
                />
        </div>
    )
}

// const CACHE_TEMP_NAME = 'fichiersDechiffresTmp'

// async function handleDownloadUpdate(transfertFichiers, params, setEtatDownload) {
//     const etat = await transfertFichiers.down_getEtatCourant()
//     const etatComplet = {...params, ...etat}
//     setEtatDownload(etatComplet)

//     if(params.fuuidReady) {
//         const infoFichier = etat.downloads.filter(item=>item.fuuid===params.fuuidReady).pop()
//         try {
//             // console.debug("InfoFichier download : %O", infoFichier)
//             downloadCache(params.fuuidReady, {filename: infoFichier.filename})
//         } catch(err) {
//             console.error("Erreur download cache : %O", err)
//             throw err  // Todo : erreurCb
//         }
//     }
// }

// async function handleUploadUpdate(transfertFichiers, params, setEtatUpload) {
//     // const { nbFichiersPending, pctFichierEnCours } = params
//     const etat = await transfertFichiers.up_getEtatCourant()
//     const etatComplet = {...params, ...etat}
//     setEtatUpload(etatComplet)
// }

// async function downloadCache(fuuid, opts) {
//     opts = opts || {}
//     if(fuuid.currentTarget) fuuid = fuuid.currentTarget.value
//     // console.debug("Download fichier : %s = %O", fuuid, opts)
//     const cacheTmp = await caches.open(CACHE_TEMP_NAME)
//     const cacheFichier = await cacheTmp.match('/'+fuuid)
//     // console.debug("Cache fichier : %O", cacheFichier)
//     if(cacheFichier) {
//         promptSaveFichier(await cacheFichier.blob(), opts)
//     } else {
//         console.warn("Fichier '%s' non present dans le cache", fuuid)
//     }
// }

// function promptSaveFichier(blob, opts) {
//     opts = opts || {}
//     const filename = opts.filename
//     let objectUrl = null
//     try {
//         objectUrl = window.URL.createObjectURL(blob)
//         const a = document.createElement('a')
//         a.href = objectUrl
//         if (filename) a.download = filename
//         if (opts.newTab) a.target = '_blank'
//         a.click()
//     } finally {
//         if (objectUrl) {
//             try {
//                 URL.revokeObjectURL(objectUrl)
//             } catch (err) {
//                 console.debug("Erreur revokeObjectURL : %O", err)
//             }
//         }
//     }
// }

function EtatDownload(props) {

    // console.debug("EtatDownload PROPPYS %O", props)

    const { workers, continuerDownloads, supprimerDownloads } = props
    // const { transfertFichiers } = workers
    const { traitementFichiers } = workers
    const downloads = props.downloads || []

    const downloadClick = useCallback(event=>{
        const fuuid = event.currentTarget.value
        const { filename } = event.currentTarget.dataset
        traitementFichiers.downloadCache(fuuid, {filename})
    }, [])

    const supprimerDownloadAction = useCallback( event => {
        const fuuid = event.currentTarget.value
        // console.debug("Supprimer download ", fuuid)
        supprimerDownloads({fuuid})
        // transfertFichiers.down_supprimerDownloads({hachage_bytes: fuuid})
        //     .catch(err=>{console.error("Erreur supprimer download %O", err)})
    }, [supprimerDownloads])

    const supprimerDownloadsSuccesAction = useCallback( event => {
        // console.debug("Supprimer tous downloads")
        supprimerDownloads({succes: true})
    }, [supprimerDownloads])

    const supprimerDownloadsErreurAction = useCallback( event => {
        // console.debug("Supprimer tous downloads")
        supprimerDownloads({echecs: true})
    }, [supprimerDownloads])

    const retryDownloadAction = useCallback( event => {
        const fuuid = event.currentTarget.value
        // transfertFichiers.down_retryDownload(fuuid)
        //     .catch(err=>{console.error("Erreur retry download %O", err)})
    }, [continuerDownloads])

    const downloadsPending = downloads.filter(item=>item.etat===CONST_ETATS_DOWNLOAD.ETAT_PRET)
    const downloadEnCours = downloads.filter(item=>item.etat===CONST_ETATS_DOWNLOAD.ETAT_EN_COURS).pop() || ''
    const downloadsCompletes = downloads.filter(item=>item.etat===CONST_ETATS_DOWNLOAD.ETAT_SUCCES)
    const downloadsErreur = downloads.filter(item=>item.etat===CONST_ETATS_DOWNLOAD.ETAT_ECHEC)
    
    const compteEnCours = downloadsPending.length + (downloadEnCours?1:0)

    const downloadActif = (compteEnCours)?true:false

    let progres = ''
    if(downloadEnCours && downloadEnCours.taille && downloadEnCours.tailleCompletee) {
        const progresFloat = 100.0 * downloadEnCours.tailleCompletee / downloadEnCours.taille
        progres = ''+Math.floor(progresFloat)
        // console.debug("Progres %O (%O), tailleCompletee %d / %d ", progres, progresFloat, downloadEnCours.tailleCompletee, downloadEnCours.taille)
    }

    return (
        <div>
            <Row className={styles['modal-row-header']}>
                <Col xs={6}>
                    Downloads en cours {compteEnCours?<Badge>{compteEnCours}</Badge>:''}
                </Col>
                <Col>
                    {downloadActif?
                        <ProgressBar now={progres} label={progres+' %'} className={styles.progressmin} />
                        :''
                    }
                </Col>
            </Row>

            {downloadActif?''
                :
                <Row>
                    <Col>Aucun download en cours</Col>
                </Row>
            }

            {downloadEnCours?
                <DownloadEnCours key={downloadEnCours.fuuid} value={downloadEnCours} annulerDownloadAction={supprimerDownloadAction} />
                :''
            }

            {downloadsPending.map(item=>{
                return <DownloadPending key={item.fuuid} value={item} annulerDownloadAction={supprimerDownloadAction} />
            })}

            <DownloadsErreur
                downloadsErreur={downloadsErreur} 
                supprimerDownload={supprimerDownloadAction} 
                supprimerTous={supprimerDownloadsErreurAction} 
                retryDownloadAction={retryDownloadAction} />

            <DownloadsSucces 
                downloadsCompletes={downloadsCompletes} 
                supprimerDownloadAction={supprimerDownloadsSuccesAction} 
                supprimerTousDownloadsAction={supprimerDownloadsSuccesAction} 
                downloadClick={downloadClick} />
        </div>
    )
}

function DownloadsSucces(props) {
    const { supprimerDownloadAction, supprimerTousDownloadsAction, downloadClick } = props
    const downloadsCompletes = props.downloadsCompletes || []

    const [show, setShow] = useState(false)

    const nbDownload = downloadsCompletes.length

    if(nbDownload === 0) return ''

    return (
        <div>
            <Row className={styles['modal-row-header']}>
                <Col xs={6}>
                    Downloads reussis {nbDownload?<Badge>{nbDownload}</Badge>:''}
                </Col>
                <Col className={styles['boutons-droite']}>
                    <Button variant="secondary" onClick={()=>setShow(!show)}>
                        {show?
                            <i className="fa fa-minus-square-o" />
                            :
                            <i className="fa fa-plus-square-o" />
                        }
                    </Button>

                    <Button 
                        variant="secondary" 
                        onClick={supprimerTousDownloadsAction}
                        disabled={nbDownload===0}>
                            <i className="fa fa-lg fa-times-circle"/>
                    </Button>                
                </Col>
            </Row>
            {show?
                nbDownload>0?
                downloadsCompletes.map(item=>{
                        return <DownloadComplete
                                key={item.fuuid}
                                value={item}
                                downloadClick={downloadClick}
                                supprimerDownloadAction={supprimerDownloadAction} />
                    })
                    :
                    <p>Aucun upload complete</p>
            :''}
        </div>
    )
}

function DownloadsErreur(props) {
    const { supprimerDownload, supprimerTous, retryDownloadAction } = props
    const downloadsErreur = props.downloadsErreur || []

    const nbUpload = downloadsErreur.length

    if(nbUpload === 0) return ''
    
    return (
        <div>
            <Row className={styles['modal-row-header']}>
                <Col xs={6}>
                    Downloads en erreur {nbUpload?<Badge bg="danger">{nbUpload}</Badge>:''}
                </Col>
                <Col className={styles['boutons-droite']}>
                    <Button 
                        variant="secondary" 
                        onClick={supprimerTous}
                        disabled={nbUpload===0}>
                            <i className="fa fa-lg fa-times-circle"/>
                    </Button>                
                </Col>
            </Row>
            {nbUpload>0?
                downloadsErreur.map(item=>{
                        return <DownloadErreur 
                            key={item.fuuid} 
                            value={item} 
                            supprimerDownloadAction={supprimerDownload} 
                            retryDownloadAction={retryDownloadAction}
                        />
                    })
            :''}
        </div>
    )
}

function DownloadPending(props) {

    const { value, annulerDownloadAction } = props
    const label = value.nom || value.fuuid
    
    return (
        <Row>
            <Col>{label}</Col>
            <Col className={styles['boutons-droite']}>
                <Button 
                    variant="secondary" 
                    value={value.fuuid} 
                    onClick={annulerDownloadAction}>
                    <i className="fa fa-lg fa-times-circle"/>
                </Button>
            </Col>
        </Row>
    )
}

function DownloadEnCours(props) {
    const { value, annulerDownloadAction } = props
    
    const label = value.nom || value.fuuid

    return (
        <Row className={styles['modal-row-encours']}>
            <Col xs={6} lg={5}>{label}</Col>
            <Col className={styles['boutons-droite']}>
                <Button 
                    variant="secondary" 
                    value={value.fuuid} 
                    onClick={annulerDownloadAction}>
                    <i className="fa fa-lg fa-times-circle"/>
                </Button>
            </Col>
        </Row>
    )
}

function DownloadComplete(props) {
    const { value, downloadClick, supprimerDownloadAction } = props

    const label = value.nom || value.fuuid

    return (
        <Row>
            <Col xs={6} lg={7}>{label}</Col>
            <Col className={styles['boutons-droite']}>
                <Button 
                    variant="secondary" 
                    size="sm" 
                    value={value.fuuid}
                    data-filename={label}
                    onClick={downloadClick}
                    className={styles.lignehover}>
                    <i className="fa fa-lg fa-cloud-download"/>
                </Button>
                <Button 
                    variant="secondary" 
                    size="sm" 
                    value={value.fuuid}
                    onClick={supprimerDownloadAction}
                    className={styles.lignehover}>
                    <i className="fa fa-lg fa-times-circle"/>
                </Button>
            </Col>
        </Row>
    )
}

function DownloadErreur(props) {
    // console.debug("DownloadError proppies : %O", props)
    const { value, supprimerDownloadAction, retryDownloadAction } = props
    const err = value.err || {}

    const label = value.nom || value.fuuid

    const [showErreur, setShowErreur] = useState(false)

    const toggleShow = useCallback(()=>setShowErreur(!showErreur), [showErreur, setShowErreur])

    return (
        <div>
            <Row className={styles['modal-row-erreur']}>
                <Col xs={6} lg={7} className={styles['modal-nomfichier']}>{label} <i className="fa fa-cross"/></Col>
                <Col className={styles['boutons-droite']}>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        value={value.fuuid}
                        onClick={retryDownloadAction}>
                        <i className="fa fa-lg fa-refresh"/>
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={toggleShow}>
                        <i className="fa fa-lg fa-info-circle"/>
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        value={value.fuuid} 
                        onClick={supprimerDownloadAction}>
                        <i className="fa fa-lg fa-times-circle"/>
                    </Button>
                </Col>
            </Row>
            <Alert variant="danger" show={showErreur}>
                <Alert.Heading>Erreur download</Alert.Heading>
                {err.msg?<p>{err.msg}</p>:''}
                {err.stack?<pre>{err.stack}</pre>:''}
            </Alert>
        </div>
    )
}


function EtatUpload(props) {

    // console.debug('EtatUpload proppies : ', props)

    const { uploads, progresUpload, continuerUploads, supprimerUploads } = props

    const supprimerUploadAction = useCallback( event => {
        const value = event.currentTarget.value
        supprimerUploads({correlation: value})
    }, [supprimerUploads])

    const supprimerTousUploadsSuccesAction = useCallback( () => {
        supprimerUploads({succes: true})
    }, [supprimerUploads])

    const supprimerTousUploadsEchecAction = useCallback( () => {
        supprimerUploads({echec: true})
    }, [supprimerUploads])

    const handlerContinuerUpload = useCallback( event => {
        const value = event.currentTarget.value
        continuerUploads({correlation: value})
    }, [continuerUploads])

    const handlerContinuerTousUploads = useCallback( () => {
        continuerUploads({tous: true})
    }, [continuerUploads])

    // const ETAT_PREPARATION = 1,
    // ETAT_PRET = 2,
    // ETAT_UPLOADING = 3,
    // ETAT_COMPLETE = 4,
    // ETAT_ECHEC = 5,
    // ETAT_CONFIRME = 6,
    // ETAT_UPLOAD_INCOMPLET = 7

    const uploadsPending = uploads.filter(item=>item.etat===ETAT_PRET)
    const uploadsSucces = uploads.filter(item=>[ETAT_COMPLETE, ETAT_CONFIRME].includes(item.etat))
    const uploadsErreur = uploads.filter(item=>[ETAT_ECHEC, ETAT_UPLOAD_INCOMPLET].includes(item.etat))
    const uploadEnCours = uploads.filter(item=>item.etat===ETAT_UPLOADING).pop()

    // const uploadsPending = etat.uploadsPending || []
    // const uploadsCompletes = etat.uploadsCompletes || []
    // const uploadEnCours = etat.uploadEnCours || {}
    // const pctFichierEnCours = uploadEnCours.pctFichierEnCours || ''
    // const uploadsSucces = uploadsCompletes.filter(item=>item.status===5)
    // const uploadsErreur = uploadsCompletes.filter(item=>item.status===4)
    
    const uploadActif = (uploadEnCours)?true:false

    let progresSpan = '-'
    if(!isNaN(progresUpload)) progresSpan = progresUpload + ' %'

    return (
        <div>
            <Row className={styles['modal-row-header']}>
                <Col xs={6}>
                    Uploads en cours {uploadActif?<Badge>1</Badge>:''}
                </Col>
                <Col>
                    {uploadActif?
                        <ProgressBar now={progresUpload} label={progresSpan} className={styles.progressmin} />
                        :''
                    }
                </Col>
            </Row>

            {uploadActif?''
                :
                <Row>
                    <Col>Aucun upload en cours</Col>
                </Row>
            }

            {uploadEnCours?
                <UploadEnCours value={uploadEnCours} annuler={supprimerUploadAction} />
                :''
            }

            {uploadsPending.map(item=>{
                return <UploadPending key={item.correlation} value={item} annuler={supprimerUploadAction} />
            })}
            
            <UploadsErreur
                uploadsErreur={uploadsErreur} 
                supprimerUploadAction={supprimerUploadAction}
                handlerContinuerUpload={handlerContinuerUpload} 
                handlerContinuerTousUploads={handlerContinuerTousUploads}
                supprimerTous={supprimerTousUploadsEchecAction} />

            <UploadsSucces 
                uploadsSucces={uploadsSucces} 
                supprimerUploadAction={supprimerUploadAction} 
                supprimerTous={supprimerTousUploadsSuccesAction} />
        </div>
    )
}

function UploadsSucces(props) {
    const { supprimerUploadAction, supprimerTous } = props
    const uploadsSucces = props.uploadsSucces || []

    const [show, setShow] = useState(false)

    const nbUpload = uploadsSucces.length

    if(nbUpload === 0) return ''

    return (
        <div>
            <Row className={styles['modal-row-header']}>
                <Col xs={6}>
                    Uploads reussis {nbUpload?<Badge>{nbUpload}</Badge>:''}
                </Col>
                <Col className={styles['boutons-droite']}>
                    <Button variant="secondary" onClick={()=>setShow(!show)}>
                        {show?
                            <i className="fa fa-minus-square-o" />
                            :
                            <i className="fa fa-plus-square-o" />
                        }
                    </Button>

                    <Button 
                        variant="secondary" 
                        onClick={supprimerTous}
                        disabled={nbUpload===0}>
                            <i className="fa fa-lg fa-times-circle"/>
                    </Button>                
                </Col>
            </Row>
            {show?
                nbUpload>0?
                    uploadsSucces.map(item=>{
                        return <UploadComplete key={item.correlation} value={item} supprimer={supprimerUploadAction} />
                    })
                    :
                    <p>Aucun upload complete</p>
            :''}
        </div>
    )
}

function UploadsErreur(props) {
    const { supprimerUploadAction, handlerContinuerUpload, handlerContinuerTousUploads, supprimerTous } = props
    const uploadsErreur = props.uploadsErreur || []

    const nbUpload = uploadsErreur.length

    if(nbUpload === 0) return ''

    return (
        <div>
            <Row>
                <Col>
                    <Button disabled={!uploadsErreur} onClick={handlerContinuerTousUploads}>Redemarrer</Button>
                </Col>
            </Row>
            <Row className={styles['modal-row-header']}>
                <Col xs={6}>
                    Uploads en erreur {nbUpload?<Badge bg="danger">{nbUpload}</Badge>:''}
                </Col>
                <Col className={styles['boutons-droite']}>
                    <Button 
                        variant="secondary" 
                        onClick={supprimerTous}
                        disabled={nbUpload===0}>
                            <i className="fa fa-lg fa-times-circle"/>
                    </Button>                
                </Col>
            </Row>
            {nbUpload>0?
                uploadsErreur.map(item=>{
                        return <UploadErreur 
                                    key={item.correlation} 
                                    value={item} 
                                    continuer={handlerContinuerUpload} 
                                    supprimer={supprimerUploadAction} />
                    })
            :''}
        </div>
    )
}

function UploadPending(props) {

    const { value, annuler } = props
    const nom = value.nom || value.correlation

    return (
        <Row>
            <Col>{nom}</Col>
            <Col className={styles['boutons-droite']}>
                <Button 
                    variant="secondary" 
                    value={value.correlation} 
                    onClick={annuler}>
                    <i className="fa fa-lg fa-times-circle"/>
                </Button>
            </Col>
        </Row>
    )
}

function UploadEnCours(props) {
    const { value, annuler } = props
    const nom = value.nom || value.correlation

    return (
        <Row className={styles['modal-row-encours']}>
            <Col xs={6} lg={5}>{nom}</Col>
            <Col className={styles['boutons-droite']}>
                <Button 
                    variant="secondary" 
                    value={value.correlation} 
                    onClick={annuler}>
                    <i className="fa fa-lg fa-times-circle"/>
                </Button>
            </Col>
        </Row>
    )
}

function UploadComplete(props) {
    const { value, supprimer } = props

    const nom = value.nom || value.correlation

    return (
        <Row>
            <Col xs={8}>{nom}</Col>
            <Col className={styles['boutons-droite']}>
                <Button 
                    variant="secondary" 
                    size="sm" 
                    value={value.correlation} 
                    onClick={supprimer}
                    className={styles.lignehover}>
                    <i className="fa fa-lg fa-times-circle"/>
                </Button>
            </Col>
        </Row>
    )
}

function UploadErreur(props) {
    const { value, continuer, supprimer } = props
    const err = value.err || {}
    const nom = value.nom || value.correlation

    const [showErreur, setShowErreur] = useState(false)

    const toggleShow = useCallback(()=>setShowErreur(!showErreur), [showErreur, setShowErreur])

    // console.debug("UploadErreur Value fichier : %O", value)

    return (
        <div>
            <Row className={styles['modal-row-erreur']}>
                <Col xs={8} className={styles['modal-nomfichier']}>{nom} <i className="fa fa-cross"/></Col>
                <Col className={styles['boutons-droite']}>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={toggleShow}
                      >
                        <i className="fa fa-lg fa-info-circle"/>
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        value={value.correlation} 
                        onClick={continuer}
                      >
                        <i className="fa fa-lg fa-upload"/>
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        value={value.correlation} 
                        onClick={supprimer}
                      >
                        <i className="fa fa-lg fa-times-circle"/>
                    </Button>
                </Col>
            </Row>
            <Alert variant="danger" show={showErreur}>
                <Alert.Heading>Erreur upload</Alert.Heading>
                {err.msg?<p>{err.msg}</p>:''}
                {err.stack?<pre>{err.stack}</pre>:''}
            </Alert>
        </div>
    )
}
