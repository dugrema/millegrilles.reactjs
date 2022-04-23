import React, { useState, useEffect, useCallback } from 'react'
import { proxy } from 'comlink'
import Modal from 'react-bootstrap/Modal'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

function TransfertModal(props) {

    const { workers, setEtatTransfert } = props
    const { transfertFichiers } = workers

    const [etatDownload, setEtatDownload] = useState({})
    const [etatUpload, setEtatUpload] = useState({})

    // Transferer etat transfert global
    useEffect(()=>{
        // console.debug("Transfert update\nDownload : %O\nUpload: %O", etatDownload, etatUpload)
        setEtatTransfert({download: etatDownload, upload: etatUpload})
    }, [setEtatTransfert, etatDownload, etatUpload])

    // Entretien idb/cache de fichiers
    useEffect(()=>{
        if(!transfertFichiers) return 
        transfertFichiers.down_entretienCache()
        // const intervalId = setInterval(()=>{transfertFichiers.down_entretienCache()}, 300000)

        const proxySetEtatDownload = proxy((pending, pct, flags)=>{
            flags = flags || {}
            // console.debug("Set nouvel etat download. pending:%d, pct:%d, flags: %O", pending, pct, flags)
            handleDownloadUpdate(transfertFichiers, {pending, pct, ...flags}, setEtatDownload)
        })
        transfertFichiers.down_setCallbackDownload(proxySetEtatDownload)

        // Faire premiere maj
        handleDownloadUpdate(transfertFichiers, {}, setEtatDownload)

        const proxySetEtatUpload = proxy((nbFichiersPending, pctFichierEnCours, flags)=>{
            flags = flags || {}
            handleUploadUpdate(transfertFichiers, {nbFichiersPending, pctFichierEnCours, ...flags}, setEtatUpload)
        })
        transfertFichiers.up_setCallbackUpload(proxySetEtatUpload)

        return () => {
            // clearInterval(intervalId)
            transfertFichiers.down_entretienCache()
        }
    }, [transfertFichiers])

    return (
        <Modal 
            show={props.show} 
            onHide={props.fermer} 
        >
            <Modal.Header closeButton>
                <Modal.Title>
                    Transfert de fichiers
                </Modal.Title>
            </Modal.Header>

            <EtatDownload workers={workers} etat={etatDownload} />

            <hr />

            <EtatUpload workers={workers} etat={etatUpload} />

        </Modal>
    )

}

export default TransfertModal

const CACHE_TEMP_NAME = 'fichiersDechiffresTmp'

async function handleDownloadUpdate(transfertFichiers, params, setEtatDownload) {
    // console.debug("handleDownloadUpdate params: %O", params)
    // const {pending, pct, filename, fuuid} = params
    const etat = await transfertFichiers.down_getEtatCourant()
    const etatComplet = {...params, ...etat}
    // console.debug("Etat download courant : %O", etatComplet)
    setEtatDownload(etatComplet)

    if(params.fuuidReady) {
        const infoFichier = etat.downloads.filter(item=>item.fuuid===params.fuuidReady).pop()
        // console.debug("Download cache avec fuuid: %s, fichier: %O", params.fuuidReady, infoFichier)
        downloadCache(params.fuuidReady, {filename: infoFichier.filename})
    }
}

async function handleUploadUpdate(transfertFichiers, params, setEtatUpload) {
    // const { nbFichiersPending, pctFichierEnCours } = params
    const etat = await transfertFichiers.up_getEtatCourant()
    const etatComplet = {...params, ...etat}
    setEtatUpload(etatComplet)
}

async function downloadCache(fuuid, opts) {
    opts = opts || {}
    if(fuuid.currentTarget) fuuid = fuuid.currentTarget.value
    // console.debug("Download fichier : %s = %O", fuuid, opts)
    const cacheTmp = await caches.open(CACHE_TEMP_NAME)
    const cacheFichier = await cacheTmp.match('/'+fuuid)
    // console.debug("Cache fichier : %O", cacheFichier)
    if(cacheFichier) {
        promptSaveFichier(await cacheFichier.blob(), opts)
    } else {
        console.warn("Fichier '%s' non present dans le cache", fuuid)
    }
}

function promptSaveFichier(blob, opts) {
    opts = opts || {}
    const filename = opts.filename
    let objectUrl = null
    try {
        objectUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        if (filename) a.download = filename
        if (opts.newTab) a.target = '_blank'
        a.click()
    } catch (err) {
        console.error("Erreur download : %O", err)
    } finally {
        if (objectUrl) {
            try {
                URL.revokeObjectURL(objectUrl)
            } catch (err) {
                console.debug("Erreur revokeObjectURL : %O", err)
            }
        }
    }
}

function EtatDownload(props) {

    // console.debug("EtatDownload PROPPYS %O", props)

    const { workers, etat } = props
    const { transfertFichiers } = workers
    const { downloads } = etat || []

    const downloadClick = useCallback(event=>{
        const fuuid = event.currentTarget.value
        const { filename } = event.currentTarget.dataset
        downloadCache(fuuid, {filename})
    }, [])

    const annulerDownloadAction = useCallback( event => {
        const fuuid = event.currentTarget.value
        transfertFichiers.down_annulerDownload(fuuid)
            .catch(err=>{console.error("Erreur annuler download %O", err)})
    }, [transfertFichiers])

    const supprimerDownloadAction = useCallback( event => {
        const fuuid = event.currentTarget.value
        transfertFichiers.down_supprimerDownloads({hachage_bytes: fuuid})
            .catch(err=>{console.error("Erreur supprimer download %O", err)})
    }, [transfertFichiers])

    const supprimerTousDownloadsAction = useCallback( event => {
        transfertFichiers.down_supprimerDownloads({completes: true})
            .catch(err=>{console.error("Erreur supprimer tous %O", err)})
    }, [transfertFichiers])

    const retryDownloadAction = useCallback( event => {
        const fuuid = event.currentTarget.value
        transfertFichiers.down_retryDownload(fuuid)
            .catch(err=>{console.error("Erreur retry download %O", err)})
    }, [transfertFichiers])

    return (
        <div>
            <p>Downloads</p>
            <Row>
                <Col>
                    <Button variant="secondary" onClick={supprimerTousDownloadsAction}>Clear downloads</Button>
                </Col>
            </Row>
            {downloads.map(item=>{

                if(item.status === 1) {
                    return <DownloadPending key={item.fuuid} value={item} annulerDownloadAction={annulerDownloadAction} />
                }
                if(item.status === 2) {
                    return <DownloadEnCours key={item.fuuid} etat={etat} value={item} annulerDownloadAction={annulerDownloadAction} />
                }
                if(item.status === 3) {
                    return (
                        <DownloadComplete
                            key={item.fuuid} 
                            value={item} 
                            downloadClick={downloadClick} 
                            supprimerDownloadAction={supprimerDownloadAction} 
                        />
                    )
                }
                if(item.status === 4) {
                    return (
                        <DownloadErreur 
                            key={item.fuuid} 
                            value={item} 
                            supprimerDownloadAction={supprimerDownloadAction} 
                            retryDownloadAction={retryDownloadAction}
                        />
                    )
                }

                return ''
            })}
        </div>
    )
}

function DownloadPending(props) {

    const { value, annulerDownloadAction } = props

    return (
        <Row>
            <Col>{value.filename}</Col>
            <Col>
                <Button 
                    variant="secondary" 
                    value={value.fuuid} 
                    onClick={annulerDownloadAction}
                >
                    Annuler
                </Button>
            </Col>
        </Row>
    )
}

function DownloadEnCours(props) {
    const { etat, value, annulerDownloadAction } = props
    const pct = etat.pct

    return (
        <Row>
            <Col>{value.filename}</Col>
            <Col>{pct}</Col>
            <Col>
                <Button 
                    variant="secondary" 
                    value={value.fuuid} 
                    onClick={annulerDownloadAction}
                >
                    Annuler
                </Button>
            </Col>
        </Row>
    )
}

function DownloadComplete(props) {
    const { value, downloadClick, supprimerDownloadAction } = props

    return (
        <Row>
            <Col>{value.filename}</Col>
            <Col>
                <Button 
                    variant="secondary" 
                    value={value.fuuid} 
                    data-filename={value.filename}
                    onClick={downloadClick}
                >
                    Download
                </Button>
                <Button 
                    variant="secondary" 
                    value={value.fuuid} 
                    onClick={supprimerDownloadAction}
                >
                    Supprimer
                </Button>
            </Col>
        </Row>
    )
}

function DownloadErreur(props) {
    const { value, supprimerDownloadAction, retryDownloadAction } = props

    return (
        <Row>
            <Col>{value.filename}</Col>
            <Col>Erreur</Col>
            <Col>
                <Button 
                    variant="secondary" 
                    value={value.fuuid} 
                    onClick={retryDownloadAction}
                >
                    Retry
                </Button>
                <Button 
                    variant="secondary" 
                    value={value.fuuid} 
                    onClick={supprimerDownloadAction}
                >
                    Supprimer
                </Button>
            </Col>
        </Row>
    )
}

function EtatUpload(props) {

    // console.debug("EtatUpload : %O", props)

    const { workers, etat } = props
    const { transfertFichiers } = workers

    const annulerUploadAction = useCallback( event => {
        const correlation = event.currentTarget.value
        transfertFichiers.up_annulerUpload(correlation)
            .catch(err=>{console.error("Erreur annuler download %O", err)})
    }, [transfertFichiers])

    const supprimerUploadAction = useCallback( event => {
        const correlation = event.currentTarget.value
        transfertFichiers.up_clearCompletes({correlation})
            .catch(err=>{console.error("Erreur supprimer download %O", err)})
    }, [transfertFichiers])

    const supprimerTousUploadsAction = useCallback( event => {
        transfertFichiers.up_clearCompletes()
            .catch(err=>{console.error("Erreur supprimer tous %O", err)})
    }, [transfertFichiers])

    const uploadsPending = etat.uploadsPending || []
    const uploadsCompletes = etat.uploadsCompletes || []
    
    return (
        <div>
            <p>Uploads</p>
            <Row>
                <Col>
                    <Button variant="secondary" onClick={supprimerTousUploadsAction}>Clear uploads</Button>
                </Col>
            </Row>
            {uploadsPending.map(item=>{
                return <UploadPending key={item.correlation} value={item} annuler={annulerUploadAction} />
            })}
            {etat.uploadEnCours?
                <UploadEnCours etat={etat} value={etat.uploadEnCours} annuler={annulerUploadAction} />
                :''
            }
            {uploadsCompletes.map(item=>{
                if(item.status === 3) {
                    return <UploadComplete key={item.correlation} value={item} supprimer={supprimerUploadAction} />
                }
                if(item.status === 4) {
                    return <UploadErreur key={item.correlation} value={item} supprimer={supprimerUploadAction} />
                }
                return ''
            })}
        </div>
    )
}

function UploadPending(props) {

    const { value, annuler } = props

    return (
        <Row>
            <Col>{value.transaction.nom}</Col>
            <Col>
                <Button 
                    variant="secondary" 
                    value={value.correlation} 
                    onClick={annuler}
                >
                    Annuler
                </Button>
            </Col>
        </Row>
    )
}

function UploadEnCours(props) {
    const { etat, value, annuler } = props
    const pct = etat.pctFichierEnCours

    return (
        <Row>
            <Col>{value.transaction.nom}</Col>
            <Col>{pct}</Col>
            <Col>
                <Button 
                    variant="secondary" 
                    value={value.correlation} 
                    onClick={annuler}
                >
                    Annuler
                </Button>
            </Col>
        </Row>
    )
}

function UploadComplete(props) {
    const { value, supprimer } = props

    return (
        <Row>
            <Col>{value.transaction.nom}</Col>
            <Col>
                <Button 
                    variant="secondary" 
                    value={value.correlation} 
                    onClick={supprimer}
                >
                    Supprimer
                </Button>
            </Col>
        </Row>
    )
}

function UploadErreur(props) {
    const { value, supprimer } = props

    return (
        <Row>
            <Col>{value.transaction.nom}</Col>
            <Col>Erreur</Col>
            <Col>
                <Button 
                    variant="secondary" 
                    value={value.fuuid} 
                    onClick={supprimer}
                >
                    Supprimer
                </Button>
            </Col>
        </Row>
    )
}