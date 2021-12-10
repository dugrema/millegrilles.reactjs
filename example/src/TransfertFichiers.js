import React, {useEffect, useCallback, useState} from 'react'
import path from 'path'
import axios from 'axios'
import { proxy } from 'comlink'
import {Container, Button, Row, Col, Badge, FormControl, InputGroup} from 'react-bootstrap'
import { useDropzone } from 'react-dropzone'

import loader from './workerLoader.js'
import { getUsager } from '@dugrema/millegrilles.reactjs'

const STATUS_NOUVEAU = 1,
  STATUS_ENCOURS = 2,
  STATUS_SUCCES = 3,
  STATUS_ERREUR = 4

function TransfertFichiers(props) {

    const [nomUsager, setNomUsager] = useState('proprietaire')
    const [workers, setWorkers] = useState('')
    const [etatDownload, setEtatDownload] = useState('')
    const [etatUpload, setEtatUpload] = useState('')
    const [certMaitredescles, setCertMaitredescles] = useState('')
    const { transfertFichiers } = workers

    const userOnChange = useCallback(event=>{
        setNomUsager(event.currentTarget.value)
    }, [setNomUsager])

    const userLoad = useCallback(event=>{
        charger(nomUsager, setWorkers, setEtatDownload, setEtatUpload)
    }, [nomUsager, setWorkers, setEtatDownload, setEtatUpload])

    useEffect(()=>{
        if(setWorkers && setEtatDownload && setEtatUpload) {
            charger(nomUsager, setWorkers, setEtatDownload, setEtatUpload)
        }
    }, [setWorkers, setEtatDownload, setEtatUpload])

    useEffect(()=>{
        if(!transfertFichiers) return 

        chargerCertMaitredescles(setCertMaitredescles)

        transfertFichiers.down_entretienCache()
        // const intervalId = setInterval(()=>{transfertFichiers.down_entretienCache()}, 30000)
        
        // Faire premiere maj
        handleDownloadUpdate(transfertFichiers, {})

        return () => {
            // clearInterval(intervalId)
            transfertFichiers.down_entretienCache()
        }
    }, [transfertFichiers])

    useEffect(()=>{
        if(!transfertFichiers) return
        transfertFichiers.up_setCertificat(certMaitredescles)
    }, [transfertFichiers, certMaitredescles])

    if(!workers) return <p>Chargements workers en cours</p>

    return (
        <div>
            <h1>Transfert fichiers</h1>
            <Button onClick={props.retour}>Retour</Button>
            <Row>
                <Col>Usager</Col>
                <Col>
                    <InputGroup className="mb-3">
                        <FormControl
                            placeholder="Nom Usager"
                            aria-label="Nom Usager"
                            aria-describedby="basic-addon2"
                            value={nomUsager}
                            onChange={userOnChange}
                        />
                        <Button variant="secondary" id="button-addon2" onClick={userLoad}>
                            Charger
                        </Button>
                    </InputGroup>
                </Col>
            </Row>
            <DownloadManager workers={workers} etatDownload={etatDownload} />
            <UploadManager workers={workers} etat={etatUpload} />
        </div>
    )

}

export default TransfertFichiers

async function charger(nomUsager, setWorkers, setEtatDownload, setEtatUpload) {
    const workers = loader()
    setUsager(workers, nomUsager)
    setWorkers(workers)

    const { transfertFichiers } = workers

    // Re-hook setters au besoin
    const proxySetEtatUpload = proxy((nbFichiersPending, pctFichierEnCours, flags)=>{
        console.debug("Set nouvel etat upload. nbPending:%d, pctEnCours:%d, flags: %O", nbFichiersPending, pctFichierEnCours, flags)
        setEtatUpload({nbFichiersPending, pctFichierEnCours, ...flags})
    })
    transfertFichiers.up_setCallbackUpload(proxySetEtatUpload)

    const proxySetEtatDownload = proxy((pending, pct, flags)=>{
        flags = flags || {}
        console.debug("Set nouvel etat download. pending:%d, pct:%d, flags: %O", pending, pct, flags)
        setEtatDownload({pending, pct, ...flags})
        handleDownloadUpdate(workers.transfertFichiers, {pending, pct, ...flags})
    })
    transfertFichiers.down_setCallbackDownload(proxySetEtatDownload)

    const url = new URL(window.location.href)
    // const url = new URL('https://mg-dev5.maple.maceroc.com')
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
        await chiffrage.initialiserFormatteurMessage(certificatPem, usager.dechiffrer, usager.signer, {DEBUG: false})
        
        // transfertFichiers.up_setCertificat(fullchain)
        // transfertFichiers.up_setCallbackUpload(caPem)
        // transfertFichiers.up_setDomaine(caPem)
        transfertFichiers.up_setChiffrage(chiffrage)

    } else {
        console.warn("Pas de certificat pour l'usager '%s'", nomUsager)
    }
  
}

const CACHE_TEMP_NAME = 'fichiersDechiffresTmp'

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
        console.debug("Annuler download %s", fuuid)
        transfertFichiers.down_annulerDownload(fuuid).catch(err=>{console.error("Erreur annuler download %O", err)})
    }, [downloadEnCours, transfertFichiers])

    const annulerTousDownloads = useCallback(()=>{
        console.debug("Annuler tous les downloads")
        transfertFichiers.down_annulerDownload().catch(err=>{console.error("Erreur annuler download %O", err)})
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
                            {item.status===STATUS_SUCCES?
                                <Button onClick={promptDownload} value={item.fuuid} data-filename={item.filename}>Download</Button>
                                :
                                <p>Erreur de preparation</p>
                            }
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

function UploadManager(props) {
    // console.debug("UploadManager proppys : %O", props)
    const { transfertFichiers } = props.workers

    const onDrop = useCallback(async acceptedFiles => {
        console.debug("Accepted files : %O", acceptedFiles)
        // const proxyAcceptedFiles = comlinkProxy(acceptedFiles)
        await transfertFichiers.up_ajouterFichiersUpload(acceptedFiles)
      }, [transfertFichiers])
    const dzHook = useDropzone({onDrop})
    console.debug("DZ Hook : %O", dzHook)
    const {getRootProps, getInputProps, isDragActive, open: openDropzone} = dzHook

    const inputProps = getInputProps()
    console.debug("Input props : %O", inputProps)

    const onClickBack = useCallback(event=>{
        event.stopPropagation()
        event.preventDefault()
        console.debug("Bloquer event click dropzone : %O", event)
    }, [])

    const onClickBouton = useCallback(event=>{
        event.stopPropagation()
        event.preventDefault()
        console.debug("Click bouton : %O, openDropzone : %O", event, openDropzone)
        openDropzone()
    }, [openDropzone])

    const classNameDrag = isDragActive?'dragActive':''

    return (
        <Container {...getRootProps({onClick: onClickBack})}>
            <h1>Upload manager</h1>

            <input {...inputProps} />
            <Row className={classNameDrag}>
                <Col>Upload un fichier</Col>
                <Col>
                    <Button className="individuel" variant="secondary" onClick={onClickBouton}>
                        Upload
                    </Button>
                </Col>
            </Row>

            <h2>Etat upload</h2>
            <EtatUpload workers={props.workers} etat={props.etat} />

            <p></p>

            <Row>
                <Col>
                    <Button onClick={()=>props.retour()}>Retour</Button>
                </Col>
            </Row>
        </Container>
    )
}

function EtatUpload(props) {
    console.debug("Etat proppys : %O", props)
    const { etat, workers } = props
    const { transfertFichiers } = workers

    const [etatComplet, setEtatComplet] = useState('')
    useEffect(()=>{
        if(!transfertFichiers || !etat) return
        transfertFichiers.up_getEtatCourant()
            .then(etatCourant=>{
                console.debug("Etat complet : %O", etatCourant)
                setEtatComplet({...etat, ...etatCourant})
            }).catch(err=>{console.warn("Erreur maj etat courant : %O", err)})
    }, [transfertFichiers, etat])

    const cancel = useCallback(event=>{
        event.stopPropagation()

        console.debug("Annuler transfer courant")
        transfertFichiers.up_annulerUpload()
    }, [transfertFichiers])

    if(!etat) return ''

    const encours = etatComplet.encours || ''
    const pctEnCours = etatComplet.pctFichierEnCours
    const pctTotal = isNaN(etatComplet.pctTotal)?100:etatComplet.pctTotal
    const uploadsPending = (etatComplet?etatComplet.uploadsPending:null) || []
    const uploadsCompletes = (etatComplet?etatComplet.uploadsCompletes:null) || []

    return (
        <>
            <Row>
                <Col>Etat upload</Col>
            </Row>
            <Row>
                <Col>Icone/bouton info upload</Col>
                <Col>
                    <IconeInfoUpload etat={etat}/>
                </Col>
            </Row>

            <Row>
                <Col>Progres total</Col>
                <Col>{pctTotal} %</Col>
            </Row>

            <UploadsPending workers={props.workers} uploadsPending={uploadsPending} />

            <p></p>
            {encours?
                <Row>
                    <Col>Fichier courant</Col>
                    <Col>{encours}</Col>
                    <Col>{pctEnCours}%</Col>
                    <Col><Button onClick={cancel}>Annuler</Button></Col>
                </Row>
                :''
            }

            <UploadsSucces workers={props.workers} uploadsCompletes={uploadsCompletes} />

            <UploadsErreurs workers={props.workers} uploadsCompletes={uploadsCompletes} />
            
        </>
    )
}

function UploadsPending(props) {
    const { workers } = props
    const { transfertFichiers } = workers

    const annuler = useCallback(event=>{
        const correlation = event.currentTarget.value
        event.stopPropagation()
        console.debug("Annuler transfer %s", correlation)
        transfertFichiers.up_annulerUpload(correlation)
    }, [transfertFichiers])

    if(!props.uploadsPending || props.uploadsPending.length === 0) return ''

    return (
        <>
            <h2>Uploads pending</h2>
            {props.uploadsPending.map(item=>{
                const correlation = item.correlation
                return (
                    <Row key={correlation}>
                        <Col>{correlation}</Col>
                        <Col>
                            <Button onClick={annuler} value={correlation}>Annuler</Button>
                        </Col>
                    </Row>
                )
            })}
        </>
    )
}

function UploadsSucces(props) {
    const filetransferUpload = props.workers.filetransferUpload
    const nettoyer = useCallback(event=>{
        filetransferUpload.clearCompletes({status: 3})
    }, [filetransferUpload])

    if(!props.uploadsCompletes) return <p>Pas uploads completes</p>
    const uploadsSucces = props.uploadsCompletes.filter(item=>item.status===3)
    if(uploadsSucces.length === 0) return <p>Aucuns upload succes</p>

    return (
        <>
            <h2>Uploads succes</h2>
            <Row>
                <Col>
                    <Button onClick={nettoyer}>Clear</Button>
                </Col>
            </Row>
            {uploadsSucces.map(item=>{
                const correlation = item.correlation
                return (
                    <Row key={correlation}>
                        <Col>{correlation}</Col>
                    </Row>
                )
            })}
        </>
    )
}

function UploadsErreurs(props) {
    const transfertFichiers = props.workers.transfertFichiers
    const nettoyerErreurs = useCallback(event=>{
        transfertFichiers.up_clearCompletes({status: 4})
    }, [transfertFichiers])

    const retirer = useCallback(event=>{
        const correlation = event.currentTarget.value
        transfertFichiers.up_clearCompletes({correlation})
    }, [transfertFichiers])

    const nettoyerTous = useCallback(event=>{
        transfertFichiers.up_clearCompletes({status: 4})
        transfertFichiers.up_clearCompletes({status: 5})
    }, [transfertFichiers])

    const retry = useCallback(event=>{
        const correlation = event.currentTarget.value
        transfertFichiers.up_retryErreur({correlation})
    }, [transfertFichiers])

    if(!props.uploadsCompletes) return <p>Pas uploads completes</p>
    const uploadsErreurs = props.uploadsCompletes.filter(item=>item.status!==3)
    if(uploadsErreurs.length === 0) return <p>Aucuns upload en erreur/non confirme</p>

    return (
        <>
            <h2>Uploads erreurs</h2>
            <Row>
                <Col>
                    <Button onClick={nettoyerErreurs}>Clear erreurs</Button>
                    <Button onClick={nettoyerTous}>Clear tous</Button>
                    <Button onClick={retry}>Retry tous</Button>
                </Col>
            </Row>
            {uploadsErreurs.map(item=>{
                const correlation = item.correlation
                return (
                    <>
                        <Row key={correlation}>
                            <Col>{correlation}</Col>
                            <Col>
                                <Button onClick={retirer} value={correlation}>Retirer</Button>
                                <Button onClick={retry} value={correlation}>Retry</Button>
                            </Col>
                        </Row>
                        <Row>
                            <Col>
                                <pre>
                                    {JSON.stringify(item).replaceAll('\\n', '\n')}
                                </pre>
                                <hr/>
                            </Col>
                        </Row>
                        <Row>
                            <Col>
                                {item.err?
                                    <>
                                        {item.err.msg}
                                        <hr/>
                                        <pre>
                                            {JSON.stringify(item.err.stack).replaceAll('\\n', '\n')}
                                        </pre>
                                    </>    
                                    :''
                                }
                            </Col>
                        </Row>
                    </>
                )
            })}
        </>
    )
}

function IconeInfoUpload(props) {
    const etatUpload = props.etat || {}
    const { encours, nbFichiersPending } = etatUpload
    const pending = (encours?1:0) + nbFichiersPending
    return (
        <span>
            Upload
            {pending>0?
                <Badge>{pending}</Badge>
                :''
            }
        </span>
    )
}

async function chargerCertMaitredescles(setCertificat) {
    const reponse = await axios.get('/reactjs/pki.maitrecles.cert.pem')
    const certificat = reponse.data
    console.debug("Certificat maitredescles\n%s", certificat)
    setCertificat(certificat)
  }
  