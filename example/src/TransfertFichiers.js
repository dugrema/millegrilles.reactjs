import React, {useEffect, useCallback, useState} from 'react'
import path from 'path'
import { proxy } from 'comlink'
import {Button, Row, Col} from 'react-bootstrap'

import loader from './workerLoader.js'
import { getUsager } from '@dugrema/millegrilles.reactjs'

const STATUS_NOUVEAU = 1,
  STATUS_ENCOURS = 2,
  STATUS_SUCCES = 3,
  STATUS_ERREUR = 4

function TransfertFichiers(props) {

    const [workers, setWorkers] = useState('')
    const [etatDownload, setEtatDownload] = useState('')
    const { transfertFichiers } = workers

    useEffect(()=>{
        if(setWorkers && setEtatDownload) {
            charger(setWorkers, setEtatDownload)
        }
    }, [setWorkers, setEtatDownload])

    useEffect(()=>{
        if(!transfertFichiers) return 

        transfertFichiers.down_entretienCache()
        // const intervalId = setInterval(()=>{transfertFichiers.down_entretienCache()}, 30000)
        
        // Faire premiere maj
        handleDownloadUpdate(transfertFichiers, {})

        return () => {
            // clearInterval(intervalId)
            transfertFichiers.down_entretienCache()
        }
    }, [transfertFichiers])

    if(!workers) return <p>Chargements workers en cours</p>

    return (
        <div>
            <h1>Transfert fichiers</h1>
            <Button onClick={props.retour}>Retour</Button>
            <DownloadManager workers={workers} etatDownload={etatDownload} />
        </div>
    )

}

export default TransfertFichiers

async function charger(setWorkers, setEtatDownload) {
    const workers = loader()
    setUsager(workers, 'proprietaire')
    setWorkers(workers)

    const { transfertFichiers } = workers

    // Re-hook setters au besoin
    const proxySetEtatUpload = proxy((nbFichiersPending, pctFichierEnCours, flags)=>{
        console.debug("Set nouvel etat upload. nbPending:%d, pctEnCours:%d, flags: %O", nbFichiersPending, pctFichierEnCours, flags)
        // setEtatUpload({nbFichiersPending, pctFichierEnCours, flags})
    })
    transfertFichiers.up_setCallbackUpload(proxySetEtatUpload)

    const proxySetEtatDownload = proxy((pending, pct, flags)=>{
        flags = flags || {}
        console.debug("Set nouvel etat download. pending:%d, pct:%d, flags: %O", pending, pct, flags)
        setEtatDownload({pending, pct, ...flags})
        handleDownloadUpdate(workers.transfertFichiers, {pending, pct, ...flags})
    })
    transfertFichiers.down_setCallbackDownload(proxySetEtatDownload)

    // const url = new URL(window.location.href)
    const url = new URL('https://mg-dev5.maple.maceroc.com')
    url.pathname = '/reactjs/files'
    transfertFichiers.down_setUrlDownload(url.toString())
}

async function setUsager(workers, nomUsager) {
    console.debug("Usager : '%s'", nomUsager)
    const usager = await getUsager(nomUsager)
    
    if(usager && usager.certificat) {
        const { chiffrage, x509, transfertFichiers } = workers
        const fullchain = usager.certificat
        const caPem = [...fullchain].pop()

        const certificatPem = fullchain.join('')

        // Initialiser le CertificateStore
        await chiffrage.initialiserCertificateStore(caPem, {isPEM: true, DEBUG: false})
        await x509.init(caPem)
        await chiffrage.initialiserFormatteurMessage(certificatPem, usager.signer, usager.dechiffrer, {DEBUG: false})
        
    
    } else {
        console.warn("Pas de certificat pour l'usager '%s'", nomUsager)
    }
  
}

const CA_PEM = `
-----BEGIN CERTIFICATE-----
MIIEBjCCAm6gAwIBAgIKCSg3VilRiEQQADANBgkqhkiG9w0BAQ0FADAWMRQwEgYD
VQQDEwtNaWxsZUdyaWxsZTAeFw0yMTAyMjgyMzM4NDRaFw00MTAyMjgyMzM4NDRa
MBYxFDASBgNVBAMTC01pbGxlR3JpbGxlMIIBojANBgkqhkiG9w0BAQEFAAOCAY8A
MIIBigKCAYEAo7LsB6GKr+aKqzmF7jxa3GDzu7PPeOBtUL/5Q6OlZMfMKLdqTGd6
pg12GT2esBh2KWUTt6MwOz3NDgA2Yk+WU9huqmtsz2n7vqIgookhhLaQt/OoPeau
bJyhm3BSd+Fpf56H1Ya/qZl1Bow/h8r8SjImm8ol1sG9j+bTnaA5xWF4X2Jj7k2q
TYrJJYLTU+tEnL9jH2quaHyiuEnSOfMmSLeiaC+nyY/MuX2Qdr3LkTTTrF+uOji+
jTBFdZKxK1qGKSJ517jz9/gkDCe7tDnlTOS4qxQlIGPqVP6hcBPaeXjiQ6h1KTl2
1B5THx0yh0G9ixg90XUuDTHXgIw3vX5876ShxNXZ2ahdxbg38m4QlFMag1RfHh9Z
XPEPUOjEnAEUp10JgQcd70gXDet27BF5l9rXygxsNz6dqlP7oo2yI8XvdtMcFiYM
eFM1FF+KadV49cXTePqKMpir0mBtGLwtaPNAUZNGCcZCuxF/mt9XOYoBTUEIv1cq
LsLVaM53fUFFAgMBAAGjVjBUMBIGA1UdEwEB/wQIMAYBAf8CAQUwHQYDVR0OBBYE
FBqxQIPQn5vAHZiTyiUka+vTnuTuMB8GA1UdIwQYMBaAFBqxQIPQn5vAHZiTyiUk
a+vTnuTuMA0GCSqGSIb3DQEBDQUAA4IBgQBLjk2y9nDW2MlP+AYSZlArX9XewMCh
2xAjU63+nBG/1nFe5u3YdciLsJyiFBlOY2O+ZGliBcQ6EhFx7SoPRDB7v7YKv8+O
EYZOSyule+SlSk2Dv89eYdmgqess/3YyuJN8XDyEbIbP7UD2KtklxhwkpiWcVSC3
NK3ALaXwB/5dniuhxhgcoDhztvR7JiCD3fi1Gwi8zUR4BiZOgDQbn2O3NlgFNjDk
6eRNicWDJ19XjNRxuCKn4/8GlEdLPwlf4CoqKb+O31Bll4aWkWRb9U5lpk/Ia0Kr
o/PtNHZNEcxOrpmmiCIN1n5+Fpk5dIEKqSepWWLGpe1Omg2KPSBjFPGvciluoqfG
erI92ipS7xJLW1dkpwRGM2H42yD/RLLocPh5ZuW369snbw+axbcvHdST4LGU0Cda
yGZTCkka1NZqVTise4N+AV//BQjPsxdXyabarqD9ycrd5EFGOQQAFadIdQy+qZvJ
qn8fGEjvtcCyXhnbCjCO8gykHrRTXO2icrQ=
-----END CERTIFICATE-----
`

const CACHE_TEMP_NAME = 'fichiersDechiffresTmp',
      CACHE_DURABLE_NAME = 'fichiersSauvegardes'

function DownloadManager(props) {

    return (
        <>
            <p>Download manager</p>

            <ListeDownloads workers={props.workers}/>

            <EtatDownload workers={props.workers} etatDownload={props.etatDownload} />

            <FichiersCache workers={props.workers} etatDownload={props.etatDownload} />
        </>
    )
}

function ListeDownloads(props) {

    const {transfertFichiers} = props.workers

    const demarrerDownload = useCallback(event => {
        const value = event.currentTarget.value
        const {fuuid, mimetype, taille} = event.currentTarget.dataset
        let filename = path.basename(value)
        console.debug("Demarrer download %s", value)
        transfertFichiers.down_ajouterDownload(fuuid, {url: value, mimetype, filename, taille: Number.parseInt(taille)})
            .catch(err=>{console.error("Erreur demarrage download %s : %O", value, err)})
    }, [transfertFichiers])

    return (
        <>
            <h2>Fichiers disponibles</h2>
            <ul>
                <li><Button onClick={demarrerDownload} value="sample1.pdf" 
                    data-fuuid="abcd-1234" data-mimetype="application/pdf" data-taille="258432">sample1.pdf</Button></li>
                <li><Button onClick={demarrerDownload} value="p-403_032.480.mp4" 
                    data-fuuid="abcd-1235" data-mimetype="application/pdf" data-taille="1686838">p-403_032.480.mp4</Button></li>
                <li><Button onClick={demarrerDownload} value="/fichiers/file3.pdf" 
                    data-fuuid="abcd-1236" data-mimetype="application/pdf" data-taille="1">file3.pdf</Button></li>
                <li><Button onClick={demarrerDownload} value="/fichiers/file4.pdf" 
                    data-fuuid="abcd-1237" data-mimetype="application/pdf" data-taille="1">file4.pdf</Button></li>
            </ul>
        </>
    )
}

function EtatDownload(props) {
    console.debug("Etat download PROPPYS: %O", props)
    const {transfertFichiers} = props.workers
    const etatDownload = props.etatDownload

    const [etatComplet, setEtatComplet] = useState('')

    useEffect(()=>{
        if(!transfertFichiers) return // Rien a faire

        transfertFichiers.down_getEtatCourant()
            .then(etatComplet=>{
                console.debug("Etat complet download : %O", etatComplet)
                setEtatComplet(etatComplet)
            }).catch(err=>{console.warn("Erreur chargement etat courant download : %O", err)})
    }, [transfertFichiers, etatDownload])

    return (
        <>
            <h2>Etat Download</h2>
            <DownloadPending workers={props.workers} etat={etatComplet} />
            <DownloadEnCours workers={props.workers} courant={etatDownload} etat={etatComplet} />
            <DownloadFichiersPrets workers={props.workers} etat={etatComplet} />
        </>
    )
}

function DownloadPending(props) {

    const { etat } = props

    const downloads = etat.downloads || []
    const pending = downloads.filter(item=>item.status === STATUS_NOUVEAU)

    if(pending.length===0) return <p>Aucun download pending</p>

    return (
        <>
            <h2>Downloads Pending</h2>
            {pending.map(item=>{
                return (
                    <Row key={item.fuuid}>
                        <Col>{item.filename}</Col>
                        <Col>{item.taille} bytes</Col>
                    </Row>
                )
            })}
        </>
    )
}

function DownloadEnCours(props) {

    console.debug("!!! DownloadEnCors proppys : %O", props)

    const { workers, courant, etat } = props
    const { downloadEnCours } = etat

    const transfertFichiers = workers.transfertFichiers

    const annulerDownload = useCallback(()=>{
        const fuuid = downloadEnCours.fuuid
        transfertFichiers.down_annulerDownload(fuuid)
    }, [downloadEnCours, transfertFichiers])

    const annulerTousDownloads = useCallback(()=>{
        transfertFichiers.down_annulerDownload()
    }, [transfertFichiers])

    if(!downloadEnCours) return <p>Aucun download en cours</p>

    const loaded = isNaN(courant.loaded)?0:courant.loaded,
          size = isNaN(courant.size)?'':courant.size

    const pctProgres = size?Math.floor(loaded/size*100):''

    return (
        <>
            <h2>Downloads En Cours</h2>
            <Row>
                <Col>{downloadEnCours.filename}</Col>
                <Col>{pctProgres} %</Col>
                <Col>
                    <Button onClick={annulerDownload}>Annuler</Button>
                </Col>
            </Row>
            <Row>
                <Col>Progres global : {courant.pct} %</Col>
                <Col><Button variant="danger" onClick={annulerTousDownloads}>Annuler tous</Button></Col>
            </Row>
        </>
    )
}

function DownloadFichiersPrets(props) {
    const { workers, etat } = props

    const downloads = etat.downloads || []
    const downloadsCompletes = downloads.filter(item=>item.complete)
    const { transfertFichiers } = workers

    const promptDownload = useCallback(event=>{
        console.debug("Prompt %O", event.currentTarget)
        const fuuid = event.currentTarget.value
        const {filename} = event.currentTarget.dataset
        downloadCache(fuuid, {filename}).catch(err=>{console.warn("Erreur prompt download : %O", err)})
    }, [])

    const supprimer = useCallback(event => {
        const fuuid = event.currentTarget.value
        console.debug("Supprimer fuuid %s", fuuid)
        transfertFichiers.down_supprimerDownloads({hachage_bytes: fuuid})
    }, [transfertFichiers])

    const supprimerTous = useCallback(async event => {
        console.debug("Supprimer downloads completes")
        await transfertFichiers.down_supprimerDownloads({completes: true})
        console.debug("Downloads completes ont ete supprimes")

    }, [transfertFichiers])

    if(downloadsCompletes === 0) return <p>Aucuns fichiers prets</p>

    return (
        <>
            <h2>Fichiers prets</h2>

            <Button onClick={supprimerTous}>Supprimer tous</Button>

            {downloadsCompletes.map(item=>{
                return (
                    <Row key={item.fuuid}>
                        <Col>{item.filename}</Col>
                        <Col>
                            <Button onClick={promptDownload} value={item.fuuid} data-filename={item.filename}>Download</Button>
                            <Button onClick={supprimer} value={item.fuuid}>Supprimer</Button>
                        </Col>
                    </Row>
                )
            })}
        </>
    )
}

export async function handleDownloadUpdate(transfertFichiers, params) {
    console.debug("handleDownloadUpdate params: %O", params)
    // const {pending, pct, filename, fuuid} = params
    if(params.fuuidReady) {
        const etat = await transfertFichiers.down_getEtatCourant()
        const infoFichier = etat.downloads.filter(item=>item.fuuid===params.fuuidReady).pop()
        console.debug("Download cache avec fuuid: %s, fichier: %O", params.fuuidReady, infoFichier)
        downloadCache(params.fuuidReady, {filename: infoFichier.filename})
    }
}

async function downloadCache(fuuid, opts) {
    opts = opts || {}
    if(fuuid.currentTarget) fuuid = fuuid.currentTarget.value
    console.debug("Download fichier : %s = %O", fuuid, opts)
    const cacheTmp = await caches.open(CACHE_TEMP_NAME)
    const cacheFichier = await cacheTmp.match(fuuid)
    console.debug("Cache fichier : %O", cacheFichier)

    promptSaveFichier(await cacheFichier.blob(), opts)
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

function FichiersCache(props) {

    const etatDownload = props.etatDownload || {}

    const [liste, setListe] = useState('')

    const updateListe = useCallback(force=>{
        console.debug("UpdateListe : %O", etatDownload)
        if(force === true || !liste || etatDownload.fuuidReady) {
            caches.open(CACHE_TEMP_NAME)
                .then(async cache=>{
                    console.debug("Cache ouvert : %O", cache)
                    const nouvelleListe = []
                    const keys = await cache.keys()
                    console.debug("Cache keys : %O", keys)
                    for (const key of keys) {
                        console.debug("Cache key : %O", key)
                        const urlKey = new URL(key.url)
                        const info = {fuuid: path.basename(urlKey.pathname)}
                        nouvelleListe.push(info)
                    }
                    console.debug("Liste fichiers cache : %O", nouvelleListe)
                    setListe(nouvelleListe)
                }).catch(err=>{console.warn("Erreur ouverture cache : %O", err)})
        }
    }, [etatDownload])

    const downloadCacheButton = useCallback(event=>{
        console.debug("Download cache de %s", event)
        const fuuid = event.currentTarget?event.currentTarget.value:event
        downloadCache(fuuid, {filename: fuuid + '.pdf'})
    }, [updateListe])

    const deleteCacheButton = useCallback(event=>{
        console.debug("Delete cache de %s", event)
        const fuuid = event.currentTarget?event.currentTarget.value:event
        caches.open(CACHE_TEMP_NAME)
            .then(async cache=>{
                await cache.delete(fuuid)
                updateListe(true)
            }).catch(err=>{console.warn("Erreur ouverture cache : %O", err)})
    }, [updateListe])

    useEffect(()=>{ if(updateListe) updateListe() }, [updateListe])

    return (
        <>
            <h2>Liste elements cache temporaire</h2>
            {liste?liste.map(item=>{
                return (
                    <Row key={item.fuuid}>
                        <Col>{item.fuuid}</Col>
                        <Col>
                            <Button onClick={downloadCacheButton} value={item.fuuid}>Download</Button>
                            <Button onClick={deleteCacheButton} value={item.fuuid}>Delete</Button>
                        </Col>
                    </Row>
                )
            }):''}
        </>
    )
}