import React, { useState, useEffect, useCallback, useMemo } from 'react'
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

    const [errDownload, setErrDownload] = useState('')
    const [errUpload, setErrUpload] = useState('')

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
        // workers.transfertFichiers.down_retryDownload(fuuid)
        //     .catch(err=>{console.error("Erreur retry download %O", err)})
        // console.debug("Continuer download ", fuuid)
        continuerDownloads(fuuid)
    }, [workers, continuerDownloads])

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
                supprimerDownloadAction={supprimerDownloadAction} 
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

    const rows = useMemo(()=>{
        if(!downloadsErreur || downloadsErreur.length === 0) return null
        const rows = []
        let breadcrumbPath = ''
        for(const item of downloadsErreur) {
            const bcCurrent = item.breadcrumbPath
            if(bcCurrent && bcCurrent !== breadcrumbPath) {
                breadcrumbPath = bcCurrent
                rows.push(<Row key='row1' className={styles['modal-liste-transfert-path']}><Col>{bcCurrent}</Col></Row>)
            }
            rows.push(
                <DownloadErreur 
                    key={item.fuuid} 
                    value={item} 
                    supprimerDownloadAction={supprimerDownload} 
                    retryDownloadAction={retryDownloadAction}
                />                
            )
        }
        return rows
    }, [downloadsErreur, supprimerDownload, retryDownloadAction])

    if(!rows) return ''
    
    return (
        <div className={styles['modal-liste-transfert']}>
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
            {rows}
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

    const uploadsPending = uploads.filter(item=>item.etat===ETAT_PRET)
    const uploadsSucces = uploads.filter(item=>[ETAT_COMPLETE, ETAT_CONFIRME].includes(item.etat))
    const uploadsErreur = uploads.filter(item=>[ETAT_ECHEC, ETAT_UPLOAD_INCOMPLET].includes(item.etat))
    const uploadEnCours = uploads.filter(item=>item.etat===ETAT_UPLOADING).pop()
    
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

            <UploadEnCours value={uploadEnCours} annuler={supprimerUploadAction} />

            <UploadsPending value={uploadsPending} onCancel={supprimerUploadAction} />
            
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

function UploadsPending(props) {
    const { value, onCancel } = props

    const rows = useMemo(()=>{
        const rows = []
        let breadcrumbPath = ''
        for(const item of value) {
            const bcCurrent = item.breadcrumbPath
            if(bcCurrent && bcCurrent !== breadcrumbPath) {
                breadcrumbPath = bcCurrent
                rows.push(<Row  key='row1' className={styles['modal-liste-transfert-path']}><Col>{bcCurrent}</Col></Row>)
            }
            rows.push(<UploadPending key={item.correlation} value={item} annuler={onCancel} />)
        }
        return rows
    }, [value, onCancel])

    return (
        <div className={styles['modal-liste-transfert']}>
            {rows}
        </div>
    )
}

function UploadsSucces(props) {
    const { supprimerUploadAction, supprimerTous } = props
    const uploadsSucces = props.uploadsSucces || []

    const [show, setShow] = useState(false)

    const nbUpload = uploadsSucces.length

    const rows = useMemo(()=>{
        if(!uploadsSucces || uploadsSucces.length === 0) return ''
        
        const rows = []
        let breadcrumbPath = ''
        for(const item of uploadsSucces) {
            const bcCurrent = item.breadcrumbPath
            if(bcCurrent && bcCurrent !== breadcrumbPath) {
                breadcrumbPath = bcCurrent
                rows.push(<Row key='ligne-1' className={styles['modal-liste-transfert-path']}><Col>{bcCurrent}</Col></Row>)
            }
            rows.push(<UploadComplete key={item.correlation} value={item} supprimer={supprimerUploadAction} />)
        }
        
        return rows
    }, [nbUpload, uploadsSucces, supprimerUploadAction])

    if(!rows) return ''

    return (
        <div className={styles['modal-liste-transfert']}>
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
            {show?rows:''}
        </div>
    )
}

function UploadsErreur(props) {
    const { supprimerUploadAction, handlerContinuerUpload, handlerContinuerTousUploads, supprimerTous } = props
    const uploadsErreur = props.uploadsErreur || []

    const nbUpload = uploadsErreur.length

    const rows = useMemo(()=>{
        if(!uploadsErreur || uploadsErreur.length === 0) return ''
        
        const rows = []
        let breadcrumbPath = ''
        for(const item of uploadsErreur) {
            const bcCurrent = item.breadcrumbPath
            if(bcCurrent && bcCurrent !== breadcrumbPath) {
                breadcrumbPath = bcCurrent
                rows.push(<Row key='ligne-1' className={styles['modal-liste-transfert-path']}><Col>{bcCurrent}</Col></Row>)
            }
            rows.push(
                <UploadErreur key={item.correlation} 
                    value={item} 
                    continuer={handlerContinuerUpload} 
                    supprimer={supprimerUploadAction} />                
            )
        }
        
        return rows
    }, [nbUpload, uploadsErreur, supprimerUploadAction])

    if(!rows) return ''

    return (
        <div className={styles['modal-liste-transfert']}>
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
            {rows}
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

    if(!value) return ''

    const nom = value.nom || value.correlation
    const breadcrumbPath = value.breadcrumbPath?value.breadcrumbPath+'/':''

    return (
        <Row className={styles['modal-row-encours']}>
            <Col xs={8} md={9} lg={10}>{breadcrumbPath} {nom}</Col>
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
            <Col xs={8} md={9} lg={10}>{nom}</Col>
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
                <Col xs={6} lg={7} className={styles['modal-nomfichier']}>{nom} <i className="fa fa-cross"/></Col>
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
