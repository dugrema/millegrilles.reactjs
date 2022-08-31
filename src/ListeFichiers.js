import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {Container, Row, Col, Button, Modal} from 'react-bootstrap'
import VisibilitySensor from 'react-visibility-sensor'

import {Thumbnail, ThumbnailHeader, ThumbnailFooter, ThumbnailBoutonContexte} from './Thumbnail'
import { isTouchEnabled } from './detecterAppareils'
import { FormatterDate, FormatterDuree } from './Formatters'

// import 'intersection-observer'  // Pour react-is-visible
// import { useIsVisible } from 'react-is-visible'

const MIMETYPE_PDF = 'application/pdf'

export function ListeFichiers(props) {

    // Intercepter onClick pour capturer la selection
    const { modeView, onClick, onDoubleClick, onContextMenu, rows, onSelection } = props

    let ClasseViewer = useMemo(()=>{
        switch(modeView) {
            case 'thumbnails': return ListeFichiersThumbnails
            case 'thumbnails-small': return ListeFichiersThumbnails
            case 'recents': return ListeFichiersRecents
            default: 
                return ListeFichiersLignes
        }
    }, [modeView])

    // Gerer comportement selection
    const [selectionne, setSelectionne] = useState([])
    const [selectionCourante, setSelectionCourante] = useState('')
    const [touchEnabled, setTouchEnabled] = useState(false)
    
    const selectionHandler = useCallback( async (event, value) => {
        if(onSelection) {
            event.persist()  // Permet de reutiliser event avec Promises (onClick)
            const idSelection = value.fileId || value.folderId
            await setSelectionCourante(idSelection)
            await majSelection(event, value, rows, selectionCourante, selectionne, setSelectionne)
        }
        if(onClick) onClick(event, value)
    }, [onClick, onSelection, selectionne, selectionCourante, setSelectionne, setSelectionCourante, rows])
    
    const ouvrirHandler = useCallback( async (event, value) => {
        if(onDoubleClick) onDoubleClick(event, value)
    }, [onDoubleClick, touchEnabled])
    
    const touchBegin = useCallback( event => {
        // TODO
    }, [])

    const contextMenuHandler = useCallback( async (event, value) => {
        event.stopPropagation()
        event.preventDefault()

        // console.debug("Context event : %O", event.currentTarget)
        if(onSelection) {
            const idSelection = value.fileId || value.folderId
            if(!selectionne.includes(idSelection)) {
                event.persist()  // Permet de reutiliser event avec Promises (onDoubleClick)
                // On reselectionne l'element courant
                await setSelectionCourante(idSelection)
                await majSelection(event, value, rows, selectionCourante, selectionne, setSelectionne)
            }
        }
        if(onContextMenu) onContextMenu(event, value)
    }, [onContextMenu, onSelection, selectionne, selectionCourante, setSelectionne, setSelectionCourante, rows])

    useEffect(()=>{
        // Mise a jour selection (ecoute callback setSelectionne)
        if(onSelection) onSelection(selectionne)
    }, [selectionne, onSelection])

    useEffect(()=>{
        setTouchEnabled(isTouchEnabled())
    }, [setTouchEnabled])

    return (
        <div>
        <ClasseViewer 
                {...props}
                selectionne={selectionne}
                setSelectionne={setSelectionne}
                onSelectioner={selectionHandler} 
                onOuvrir={ouvrirHandler}
                onContextMenu={contextMenuHandler} 
                touchEnabled={touchEnabled} 
                touchBegin={touchBegin} />
        </div>
    )
}

async function majSelection(event, value, rows, selectionPrecedente, selectionne, setSelectionne, callback) {
    const idSelection = value.fileId || value.folderId
    const {shiftKey, ctrlKey} = event

    // Determiner comportement cles speciales
    if(!ctrlKey) {
        // Reset selection cumulee
        selectionne = []
    }

    if(shiftKey && idSelection !== selectionPrecedente) {
        // Prepare liste de tous les IDs entre selectionPrecedente et idSelection
        const resultat = rows.reduce(({modeAjout, nouvelleSelection}, item)=>{
            const idLocal = item.fileId || item.folderId

            let ajouter = modeAjout  // Conserver flag (pour inclure dernier element selectionne)
            if(idLocal === idSelection || idLocal === selectionPrecedente) {
                modeAjout = !modeAjout
            }
            ajouter = ajouter || modeAjout

            if(ajouter) nouvelleSelection = [...nouvelleSelection, idLocal]
            return {modeAjout, nouvelleSelection}
        }, {modeAjout: false, nouvelleSelection: []})

        selectionne.forEach(item=>{
            if(!resultat.nouvelleSelection.includes(item)) resultat.nouvelleSelection.push(item)
        })
        selectionne = resultat.nouvelleSelection

    } else if(ctrlKey) {
        // Toggle l'identificateur
        if(selectionne.includes(idSelection)) {
            // Retirer l'identificateur
            selectionne = selectionne.filter(item=>item!==idSelection)
        } else {
            // Ajouter l'identificateur
            selectionne = [...selectionne, idSelection]
        }
    } else {
        // Ajoute l'identificateur courant
        selectionne = [...selectionne, idSelection]
    }

    await setSelectionne(selectionne)
}

/** Liste de fichiers avec details sur lignes, colonnes configurables */
function ListeFichiersLignes(props) {

    const {colonnes, rows, onSelectioner, onOuvrir, onContextMenu, touchEnabled, touchBegin, isListeComplete, suivantCb} = props

    if(!colonnes || !rows) return ''  // Ecran n'est pas encore configure

    const selectionnes = props.selectionne || []

    return (
        <div className='fichierstable'>

            <ListeFichiersEntete colonnes={colonnes} onClickEntete={props.onClickEntete} />
            
            {rows.map((row, idx)=>{
                const localId = row.tuuid || row.fileId || row.folderId
                const selectionne = selectionnes.includes(localId)
                return (
                    <ListeFichiersRow 
                        key={''+localId} 
                        colonnes={colonnes} 
                        data={row} 
                        onSelectioner={onSelectioner}
                        onOuvrir={onOuvrir} 
                        onContextMenu={onContextMenu}
                        selectionne={selectionne}
                        touchEnabled={touchEnabled}
                        touchBegin={touchBegin}
                        />
                )
            })}

            {isListeComplete?'':
                <BoutonSuivantListe suivantCb={suivantCb} />
            }

        </div>
    )
}

function BoutonSuivantListe(props) {

    const {suivantCb} = props

    const visibleSuivantCb = useCallback(isVisible=>{if(suivantCb&&isVisible)suivantCb()}, [suivantCb])

    if(!suivantCb) return ''  // Cacher le bouton si suivantCb est vide (fin de la liste)

    return (
        <VisibilitySensor onChange={visibleSuivantCb} offset={{top: 200}}>
            <Row className='section-suivante'>
                <Col>
                    <Button variant="secondary" onClick={visibleSuivantCb}><i className='fa fa-chevron-down'/></Button>
                </Col>
            </Row>
        </VisibilitySensor>
    )
}

// function BoutonSuivantListe(props) {

//     const {suivantCb} = props

//     const nodeRef = useRef()
//     const isVisible = useIsVisible(nodeRef)

//     useEffect( () => {
//         console.debug("!!! IsVisible : %O", isVisible)
//         if(!isVisible) return
//         suivantCb()
//     }, [isVisible, suivantCb])

//     if(!suivantCb) return ''  // Cacher le bouton si suivantCb est vide (fin de la liste)

//     return (
//         <Row ref={nodeRef} className='section-suivante'>
//             <Col>
//                 <Button variant="secondary" onClick={suivantCb}><i className='fa fa-chevron-down'/></Button>
//             </Col>
//         </Row>
//     )
// }

function ListeFichiersEntete(props) {
    const colonnes = props.colonnes
    const tri = colonnes.tri || {}
    const paramsColonnes = colonnes.paramsColonnes || {}
    const onClickEntete = props.onClickEntete

    const onClick = useCallback(event=>{
        const nomColonne = event.currentTarget.dataset.colonne
        // console.debug("Click header '%s' = %O", nomColonne, event.currentTarget)
        if(onClickEntete) onClickEntete(nomColonne)
    }, [onClickEntete])

    return (
        <Row className='fichierstableheader'>
            {colonnes.ordreColonnes.map(nomColonne=>{
                const param = paramsColonnes[nomColonne]
                const width = param.width || '100px'

                const label = param.label || nomColonne
                let sens = ''
                if(tri.colonne === nomColonne) {
                    const className = 'fa fa-' + (tri.ordre<0?'caret-down':'caret-up')
                    sens = <i className={className}/>
                }
                const spanLabel = <span>{label}</span>
                
                const infoDimension = {
                    xs: param.xs,
                    sm: param.sm,
                    md: param.md,
                    lg: param.lg,
                    xl: param.xl,
                }

                return (
                    <Col key={nomColonne}
                         data-colonne={nomColonne}
                         onClick={onClick}
                         {...infoDimension}>
                        {spanLabel}{' '}{sens}
                    </Col>
                )
            })}
        </Row>
    )
}

function ListeFichiersRow(props) {
    const colonnes = props.colonnes
    const { rowLoader, rowClassname } = colonnes
    const paramsColonnes = colonnes.paramsColonnes || {}
    const {data} = props
    const {onSelectioner, onOuvrir, onContextMenu, selectionne, touchEnabled, touchBegin} = props

    const [dataRow, setDataRow] = useState(data)
    const [touchEvent, setTouchEvent] = useState('')

    const {fileId, folderId} = dataRow

    const classNames = useMemo(()=>{
        let classNames = ['fichierstablerow']
        if(selectionne) classNames.push('selectionne')
        if(rowClassname) {
            const rowClasses = rowClassname(dataRow)
            if(rowClasses) {
                classNames = [...classNames, ...rowClasses.split(' ')]
            }
        }
        return classNames
    }, [dataRow, selectionne, rowClassname])

    // Thumbnails
    const thumbnail = dataRow.thumbnail || {},
          {thumbnailIcon, thumbnailSrc} = thumbnail
    const thumbnailLoader = dataRow.imageLoader

    const onClickAction = useCallback(event=>{
        if(touchEnabled) return  // Rien a faire
        if(onSelectioner && !touchEnabled) onSelectioner(event, {fileId, folderId})
    }, [onSelectioner, touchEnabled, touchBegin, fileId, folderId])

    const onDoubleClickAction = useCallback(event=>{
        if(touchEnabled === true) return  // Rien a faire
        event.preventDefault()
        event.stopPropagation()
        if(onOuvrir) onOuvrir(event, {fileId, folderId})
    }, [onOuvrir, fileId, folderId, touchEnabled])

    const onTouchMove = useCallback(event=>{
        setTouchEvent('')
    }, [setTouchEvent])

    const onTouchStart = useCallback(event=>{
        event.preventDefault()
        event.stopPropagation()
        setTouchEvent(event)
    }, [setTouchEvent])

    const onTouchEnd = useCallback(event=>{
        if(!touchEvent) return  // Deplacement

        if(onSelectioner) onSelectioner(event, {fileId, folderId})
        if(onOuvrir) onOuvrir(event, {fileId, folderId})
        setTouchEvent('')

    }, [onOuvrir, fileId, folderId, touchEvent, setTouchEvent])

    const onContextMenuAction = useCallback(event=>{
        event.stopPropagation()
        if(onContextMenu) onContextMenu(event, {fileId, folderId})
    }, [onContextMenu, fileId, folderId])

    const onBoutonContext = useCallback(event=>{
        event.stopPropagation()
        event.preventDefault()
        if(onContextMenu) onContextMenu(event, {fileId, folderId})
    })

    // Convertir data avec rowLoader au besoin
    useEffect(()=>{
        if(data && rowLoader) {
            Promise.resolve(rowLoader(data))
                .then(setDataRow)
                .catch(err=>console.error("Erreur chargement data row %O : %O", data, err))
        } else {
            setDataRow(data)
        }
    }, [data, rowLoader, setDataRow])

    return (
        <Row 
            className={classNames.join(' ')}
            onDoubleClick={onDoubleClickAction} 
            onContextMenu={onContextMenuAction}
            data-fileid={fileId}
            data-folderid={folderId}
            >
            {colonnes.ordreColonnes.map(nomColonne=>{
                const param = paramsColonnes[nomColonne]
                const width = param.width || '100px'
                const classNameCol = param.className || ''
                const className = classNameCol || param.className
                const Formatteur = param.formatteur
                const showThumbnail = param.showThumbnail || false
                const showBoutonContexte = param.showBoutonContexte || false

                const contenu = dataRow[nomColonne] || ''
                let spanContenu = <span>{contenu}</span>
                if(Formatteur) {
                    spanContenu = <span><Formatteur value={contenu} data={dataRow} /></span>
                }

                let thumbnail = ''
                if(showThumbnail) {
                    if(thumbnailSrc || thumbnailLoader) {
                        thumbnail = <Thumbnail src={thumbnailSrc} loader={thumbnailLoader} mini={true} />
                    } else if(thumbnailIcon) {
                        thumbnail = <div className='thumbnailmini'>{thumbnailIcon}</div>
                    } else {
                        thumbnail = <div className='thumbnailmini'></div>
                    }
                }
                let boutonContexte = ''
                if(showBoutonContexte) {
                    boutonContexte = (
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={onBoutonContext} 
                            className='lignehover boutoncontexte'
                        >
                            <i className="fa fa-ellipsis-h"/>
                        </Button>
                    )
                }

                const infoDimension = {
                    xs: param.xs,
                    sm: param.sm,
                    md: param.md,
                    lg: param.lg,
                    xl: param.xl,
                }

                if(boutonContexte) {
                    return (
                        <Col key={nomColonne} {...infoDimension} className={className}>
                            {boutonContexte}
                        </Col>
                    )
                }

                return (
                    <Col 
                        key={nomColonne} 
                        {...infoDimension} 
                        className={className}
                        onClick={onClickAction}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    >
                        {thumbnail}
                        {spanContenu}
                    </Col>
                )
            })}
        </Row>
    )
}

// function preparerColonnes() {
//     const params = {
//         // colonnes: ['favoris', 'nom', 'taille', 'type', 'dateAjout', 'dateModifie', 'versions', 'etiquette'],
//         ordreColonnes: ['favoris', 'nom', 'mimetype', 'taille', 'dateAjout', 'boutonDetail'],
//         paramsColonnes: {
//             'favoris': {'label': 'FV', className: 'favoris', xs: 1, lg: 1}, 
//             'nom': {'label': 'Nom', showThumbnail: true, xs: 11, lg: 4},
//             'taille': {'label': 'Taille', className: 'details', formatteur: FormatteurTaille, xs: 3, lg: 1},
//             'mimetype': {'label': 'Type', className: 'details', xs: 3, lg: 2},
//             'dateAjout': {'label': 'Date ajout', className: 'details', formatteur: FormatterDate, xs: 5, lg: 3},
//             'boutonDetail': {label: ' ', className: 'details', showBoutonContexte: true, xs: 1, lg: 1},
//         },
//         tri: {colonne: 'nom', ordre: 1},
//     }
//     return params
// }

function ListeFichiersThumbnails(props) {
    const {rows, colonnes, onSelectioner, onOuvrir, onContextMenu, touchEnabled, touchBegin, modeView, suivantCb} = props
    if(!rows) return ''  // Ecran n'est pas encore configure

    let modeSmall = ''
    if(modeView === 'thumbnails-small') modeSmall = true

    const selectionnes = props.selectionne || []
    // console.debug("ListeFichierThumbnails selectionnes : %O", selectionnes)

    return (
        <div>
            {rows.map(row=>{
                const localId = row.tuuid || row.fileId || row.folderId
                const selectionne = selectionnes.includes(localId)
                let classNames = []
                if(selectionne) classNames.push('selectionne')
                return (
                    <FichierThumbnail
                        key={localId} 
                        data={row} 
                        colonnes={colonnes}
                        onSelectioner={onSelectioner}
                        onOuvrir={onOuvrir}
                        onContextMenu={onContextMenu}
                        selectionne={selectionne}
                        touchEnabled={touchEnabled}
                        touchBegin={touchBegin}
                        className={classNames.join(' ')}
                        small={modeSmall}
                        />
                )
            })}
            
            <BoutonSuivantListe suivantCb={suivantCb} />

        </div>
    )
}

function FichierThumbnail(props) {

    const {data, colonnes, className, onSelectioner, onOuvrir, onContextMenu, touchEnabled, small, touchBegin} = props

    const { rowLoader } = colonnes
    const [ dataRow, setDataRow ] = useState('')

    const {fileId, folderId, duration} = dataRow
    const thumbnail = dataRow.thumbnail || {},
          {thumbnailIcon, thumbnailSrc, thumbnailCaption} = thumbnail

    const imageLoader = useMemo(()=>{
        if(!dataRow) return
        return dataRow.imageLoader
    }, [dataRow])

    // const thumbnailLoader = small?miniLoader:smallLoader  // small veut dire mini dans le parametre
    const [touchEvent, setTouchEvent] = useState('')

    const onClickAction = useCallback(event=>{
        if(touchEnabled) return  // Rien a faire
        if(onSelectioner) onSelectioner(event, {fileId, folderId})
    }, [touchEnabled, touchBegin, onSelectioner, fileId, folderId])

    const onDoubleClickAction = useCallback(event=>{
        if(touchEnabled) return  // Rien a faire
        event.preventDefault()
        event.stopPropagation()
        if(onOuvrir) onOuvrir(event, {fileId, folderId})
    }, [touchEnabled, onOuvrir, fileId, folderId])

    const onTouchMove = useCallback(event=>{
        setTouchEvent('')
    }, [setTouchEvent])

    const onTouchStart = useCallback(event=>{
        event.preventDefault()
        event.stopPropagation()
        setTouchEvent(event)
    }, [setTouchEvent])

    const onTouchEndAction = useCallback(event=>{
        if(!touchEvent) return  // Deplacement de l'ecran
        if(onOuvrir) onOuvrir(event, {fileId, folderId})
        setTouchEvent('')
    }, [onOuvrir, touchEvent, fileId, folderId, setTouchEvent])

    const onContextMenuAction = useCallback(event=>{
        event.stopPropagation()
        if(onContextMenu) onContextMenu(event, {fileId, folderId})
    }, [onContextMenu, fileId, folderId])

    // Convertir data avec rowLoader au besoin
    useEffect(()=>{
        if(data && rowLoader) {
            Promise.resolve(rowLoader(data))
                .then(setDataRow)
                .catch(err=>console.error("Erreur chargement data row %O : %O", data, err))
        } else {
            setDataRow(data)
        }
    }, [data, rowLoader, setDataRow])
    
    return (
        <Thumbnail
            onClick={onClickAction}
            onDoubleClick={onDoubleClickAction}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEndAction}
            onContextMenu={onContextMenuAction}
            src={thumbnailSrc}
            loader={imageLoader}
            placeholder={thumbnailIcon}
            className={className}
            small={small}
            >

            {duration?
                <ThumbnailHeader>
                    <span className='fa fa-play'/>{' '}
                    <FormatterDuree value={duration} />
                </ThumbnailHeader>            
                :''
            }

            <ThumbnailFooter>{thumbnailCaption}</ThumbnailFooter>
            
            <ThumbnailBoutonContexte onClick={onContextMenuAction} />

        </Thumbnail>
    )
}

function ListeFichiersRecents(props) {

    const {rows, suivantCb} = props
    if(!rows) return ''  // Ecran n'est pas encore configure

    const [jours, setJours] = useState('')

    useEffect(()=>{
        const jours = grouperFichiersRecents(rows)
        console.debug("Praparer rows pour recents, jours : %O", jours)
        setJours(jours)
    }, [setJours, rows])

    if(!jours) return ''

    return (
        <div>
            {jours.map(item=>{
                const keyStr = '' + item.jour.getTime()
                return (
                    <GroupeJour key={keyStr} {...props} value={item} />
                )
            })}

            <BoutonSuivantListe suivantCb={suivantCb} />

        </div>
    )
}

function GroupeJour(props) {

    const { jour, groupes } = props.value

    const groupesListe = []
    for(let type in groupes) {
        const rows = groupes[type]
        groupesListe.push({type, rows})
    }
    groupesListe.sort(trierGroupes)

    return (
        <div className='fichierstable'>
            <Row className="listerecent-jour">
                <Col><FormatterDate value={jour.getTime()/1000} format="yyyy-MM-DD"/></Col>
            </Row>
            {groupesListe.map(groupe=>{
                const { type, rows } = groupe
                return (
                    <div key={type} className="listerecent-row">
                        <Row>
                            <Col>{type}</Col>
                        </Row>
                        <Row className="listerecent-subrow">
                            <Col>
                                <ListeFichiersThumbnails {...props} rows={rows} modeView='thumbnails-small'/>
                            </Col>
                        </Row>
                    </div>
                )
            })}
        </div>
    )
}

export function MenuContextuel(props) {
    const {show, posX, posY, fermer} = props
    // console.debug("Params contextuel : %O", props)

    const [touchEnabled, setTouchEnabled] = useState(false)
    useEffect(()=>{
        setTouchEnabled(isTouchEnabled())
    }, [setTouchEnabled])

    if(touchEnabled) {
        return <MenuContextuelModal {...props} />
    }

    return <MenuContextuelRightClick {...props} />
}

function MenuContextuelRightClick(props) {
    const {show, posX, posY, fermer} = props
    // console.debug("Params contextuel : %O", props)

    const handleClick = useCallback(event=>{
        // console.debug("Fermer menu contextuel")
        fermer()
    }, [fermer])

    useEffect(()=>{
        // Enregistrer evenement click/contextmenu pour desactiver si click hors menu
        if(show) {
            document.addEventListener("click", handleClick)
            document.addEventListener("contextmenu", handleClick)

            return () => {
                document.removeEventListener("click", handleClick)
                document.removeEventListener("contextmenu", handleClick)
            }
        }
    }, [show, handleClick])

    if(!show) return ''

    // Tenter de garder la fenetre pop-up a l'interieur de l'ecran
    const posXAjuste = posX>400?posX-200:posX

    return (
        <Container style={{top: posY, left: posXAjuste}} className='menucontextuel menucontextuelpopup'>
            {props.children}
        </Container>
    )
}

export function MenuContextuelModal(props) {
    const {show, fermer} = props
    return (
        <Modal show={show} dismissible onHide={()=>fermer()} className='menucontextuel'>
            <Modal.Header closeButton />
            <Modal.Body>
                {props.children}
            </Modal.Body>
        </Modal>
    )
}

/** Grouper les fichiers recents par jour, puis par type. */
function grouperFichiersRecents(rows) {
    const joursParDate = {}

    rows.forEach(fichier=>{
        const dateFichier = fichier.dateAjout
        
        // Identifier jour
        const jour = new Date(dateFichier*1000)
        jour.setHours(0)
        jour.setMinutes(0)
        jour.setSeconds(0)
        jour.setMilliseconds(0)
        const jourMs = ''+jour.getTime()

        // Identifier type
        let typeFichier
        const mimetype = fichier.mimetype,
              baseType = mimetype.split('/').shift()
        if(mimetype === MIMETYPE_PDF) typeFichier = 'document'
        else if(baseType === 'image' || baseType === 'video') typeFichier = 'media'
        else if(fichier.folderId) typeFichier = 'collection'
        else typeFichier = 'fichier'

        let dataJour = joursParDate[jourMs]
        if(!dataJour) {
            dataJour = {}
            joursParDate[jourMs] = dataJour
        }
        let dataType = dataJour[typeFichier]
        if(!dataType) {
            dataType = []
            dataJour[typeFichier] = dataType
        }
        dataType.push(fichier)
    })

    const jours = Object.keys(joursParDate)
    console.debug("Jours keys : %O", jours)
    jours.sort(trierDates)
    const joursTries = jours.map(jour=>{
        return {
            jour: new Date(Number.parseInt(jour)), 
            groupes: joursParDate[jour]
        }
    })

    return joursTries
}

function trierDates(a, b) {
    if(a === b) return 0
    return b - a  // sort DESC
}

function trierGroupes(a, b) {
    const aType = a.type, bType = b.type
    return aType.localeCompare(bType)
}