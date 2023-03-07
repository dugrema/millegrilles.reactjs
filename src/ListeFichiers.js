import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {Container, Row, Col, Button, Modal} from 'react-bootstrap'
import VisibilitySensor from 'react-visibility-sensor'

import {Thumbnail, ThumbnailHeader, ThumbnailFooter, ThumbnailBoutonContexte} from './Thumbnail'
import { isTouchEnabled } from './detecterAppareils'
import { FormatterDate, FormatterDuree } from './Formatters'

const MIMETYPE_PDF = 'application/pdf'

const TOUCH_ENABLED = isTouchEnabled()  // Detecter touch (appareil mobile)

export function ListeFichiers(props) {

    // Intercepter onClick pour capturer la selection
    const { 
        modeView, rows, colonnes, modeSelectionActif, selection, 
        onContextMenu, onSelect, scrollValue, onScroll, onOpen,
        // colonnes, onClick, onDoubleClick, 
    } = props

    console.debug("!!! ListeFichiers props ", props)

    // const [selection, setSelection] = useState([])
    const [idxSelectionShift, setIdxSelectionShift] = useState(0)
    const [touchEvent, setTouchEvent] = useState('')
    const [scrollRestored, setScrollRestored] = useState(false)

    // const idMapperFct = colonnes.idMapper || idMapper

    // let ClasseViewer = useMemo(()=>{
    //     switch(modeView) {
    //         case 'thumbnails': return ListeFichiersThumbnails
    //         case 'thumbnails-small': return ListeFichiersThumbnails
    //         case 'recents': return ListeFichiersRecents
    //         default: 
    //             return ListeFichiersLignes
    //     }
    // }, [modeView])

    // // Gerer comportement selection
    // const [selectionne, setSelectionne] = useState([])
    // const [selectionCourante, setSelectionCourante] = useState('')
    
    // const selectionHandler = useCallback( async (event, value) => {
    //     if(onSelect) {
    //         event.persist()  // Permet de reutiliser event avec Promises (onClick)
    //         const idSelection = value.fileId || value.folderId
    //         await setSelectionCourante(idSelection)
    //         await majSelection(event, idMapperFct, value, rows, selectionCourante, selectionne, setSelectionne)
    //     }
    //     if(onClick) onClick(event, value)
    // }, [onClick, onSelect, selectionne, selectionCourante, setSelectionne, setSelectionCourante, rows])
    
    // const ouvrirHandler = useCallback( async (event, value) => {
    //     if(onDoubleClick) onDoubleClick(event, value)
    // }, [onDoubleClick, touchEnabled])
    
    // const touchBegin = useCallback( event => {
    //     // TODO
    // }, [])

    const ouvrirItemHandler = useCallback(e=>{
        const { idx, value } = e.currentTarget.dataset
        setIdxSelectionShift(idx)
        onSelect([value])
        onOpen(rows[idx])
    }, [rows, setIdxSelectionShift, onSelect, onOpen])

    const selectionToggleHandler = useCallback(e=>{
        const {shiftKey, ctrlKey} = e
        const { idx, value } = e.currentTarget.dataset

        // Mode selection - soit touche CTRL (PC) ou toggle sur mobile
        const modeSelection = ctrlKey || modeSelectionActif

        if(shiftKey) {
            // Retirer selection texte
            const selection = window.getSelection()
            selection.removeAllRanges()
        }

        // Determiner comportement cles speciales
        if(shiftKey && !selection.includes(value)) {
            // Selectionner un range
            const debut = Math.min(idx, idxSelectionShift),
                  fin = Math.max(idx, idxSelectionShift)

            // console.debug("Ajouter range %d -> %d", debut, fin)
            
            const selectionMaj = [...selection]
            for(let i=debut; i<=fin; i++) {
                const valueAdd = rows[i].value
                console.debug("Ajouter %s", valueAdd)
                if(!selectionMaj.includes(valueAdd)) selectionMaj.push(valueAdd)
            }

            // setSelection(selectionMaj)
            onSelect(selectionMaj)

        } else if(modeSelection) {
            if(!shiftKey) setIdxSelectionShift(idx)

            // Reset selection cumulee
            if( selection.includes(value) ) {
                // Deselectionner
                // console.debug("Retrait selection %s (de %O)", value, selection)
                const selectionMaj = selection.filter(item=>item!==value)
                onSelect(selectionMaj)
            } else {
                // Selectionner
                // console.debug("Ajout selection %s", value)
                onSelect([...selection, value])
            }

        } else {
            setIdxSelectionShift(idx)
            onSelect([value])
        }

    }, [rows, selection, idxSelectionShift, modeSelectionActif, onSelect, setIdxSelectionShift])

    const touchStartHandler = useCallback(e=>{
        e.preventDefault()
        if(e.touches.length > 1) {
            // Touch supplementaires cancel
            // console.debug("Multi-touch, annuler selection")
            setTouchEvent('')
            return
        }

        const dataset = e.currentTarget.dataset || e.parentElement.dataset
        const item = {...dataset}
        // console.debug("Set touch event : ", item)
        setTouchEvent(item)
    }, [setTouchEvent])

    const touchMoveHandler = useCallback(e=>{
        e.preventDefault()
        // console.debug("Move, reset")
        setTouchEvent('')  // Reset
    }, [setTouchEvent])

    const touchEndHandler = useCallback(e=>{
        e.preventDefault()
        // console.debug("end - touch event : ", touchEvent)
        setTouchEvent('')  // Reset
        if(touchEvent) {
            const eventSimule = {currentTarget: {dataset: touchEvent}}
            if(modeSelectionActif) {
                selectionToggleHandler(eventSimule)
            } else {
                ouvrirItemHandler(eventSimule)
            }
        }
    }, [modeSelectionActif, touchEvent, setTouchEvent, ouvrirItemHandler, selectionToggleHandler])

    const contextMenuHandler = useCallback( async (event, value) => {
        event.stopPropagation()
        event.preventDefault()

        // console.debug("Context event : %O", event.currentTarget)
        if(onSelect) {
            // const idSelection = idMapperFct(value)
            const value = event.currentTarget.dataset.value
            if(!selection.includes(value)) {
                // event.persist()  // Permet de reutiliser event avec Promises (onDoubleClick)
                // On reselectionne l'element courant
                onSelect([value])
                // await majSelection(event, idMapperFct, value, rows, selectionCourante, selectionne, setSelectionne)
            }
        }
        if(onContextMenu) onContextMenu(event, value)
    }, [onContextMenu, onSelect, selection, rows, onSelect])

    const eventHandlers = useMemo(()=>{
        if(TOUCH_ENABLED) {
            // Mobile
            return {
                onTouchStart: touchStartHandler,
                onTouchMove: touchMoveHandler,
                onTouchEnd: touchEndHandler,
                onContextMenu: contextMenuHandler,
            }
        } else {
            // PC
            return {
                onClick: selectionToggleHandler, 
                onDoubleClick: ouvrirItemHandler,
                onContextMenu: contextMenuHandler,
            }
        }
    }, [selectionToggleHandler, ouvrirItemHandler, touchStartHandler, touchMoveHandler, touchEndHandler])

    useEffect(()=>{
        if(scrollRestored) return
        setScrollRestored(true)
        if(scrollValue > 0) window.scroll({top: scrollValue})
    }, [scrollValue, scrollRestored, setScrollRestored])

    useEffect(() => {
        const onScrollHandler = (e) => {
            const pos = e.target.documentElement.scrollTop
            if(onScroll) onScroll(pos)
            setTouchEvent('')
        };
        window.addEventListener('scroll', onScrollHandler);
        return () => window.removeEventListener('scroll', onScrollHandler);
    }, [onScroll, setTouchEvent])

    return (
        <div>
        <ListeFichiersItems 
            modeView={modeView}
            rows={rows} 
            colonnes={colonnes}
            selection={selection}
            eventHandlers={eventHandlers} />
        </div>
    )
}

// async function majSelection(event, idMapperFct, value, rows, selectionPrecedente, selectionne, setSelectionne, callback) {
//     const idSelection = value.localId || value.fileId || value.folderId
//     const {shiftKey, ctrlKey} = event

//     // Determiner comportement cles speciales
//     if(!ctrlKey) {
//         // Reset selection cumulee
//         selectionne = []
//     }

//     if(shiftKey && idSelection !== selectionPrecedente) {
//         // Prepare liste de tous les IDs entre selectionPrecedente et idSelection
//         const resultat = rows.reduce(({modeAjout, nouvelleSelection}, item)=>{
//             const idLocal = idMapperFct(item)

//             let ajouter = modeAjout  // Conserver flag (pour inclure dernier element selectionne)
//             if(idLocal === idSelection || idLocal === selectionPrecedente) {
//                 modeAjout = !modeAjout
//             }
//             ajouter = ajouter || modeAjout

//             if(ajouter) nouvelleSelection = [...nouvelleSelection, idLocal]
//             return {modeAjout, nouvelleSelection}
//         }, {modeAjout: false, nouvelleSelection: []})

//         selectionne.forEach(item=>{
//             if(!resultat.nouvelleSelection.includes(item)) resultat.nouvelleSelection.push(item)
//         })
//         selectionne = resultat.nouvelleSelection

//     } else if(ctrlKey) {
//         // Toggle l'identificateur
//         if(selectionne.includes(idSelection)) {
//             // Retirer l'identificateur
//             selectionne = selectionne.filter(item=>item!==idSelection)
//         } else {
//             // Ajouter l'identificateur
//             selectionne = [...selectionne, idSelection]
//         }
//     } else {
//         // Ajoute l'identificateur courant
//         selectionne = [...selectionne, idSelection]
//     }

//     await setSelectionne(selectionne)
// }

/** Liste de fichiers avec details sur lignes, colonnes configurables */
function ListeFichiersItems(props) {

    console.debug("!!! ListeFichiersItems proppies ", props)

    const {
        modeView, colonnes, rows, 
        eventHandlers, 
        isListeComplete, suivantCb,
        // onSelectioner, onOuvrir, onContextMenu, touchEnabled, touchBegin, 
    } = props

    if(!colonnes || !rows) return ''  // Ecran n'est pas encore configure

    const selection = props.selection || []

    const idMapperFct = colonnes.idMapper || idMapper

    return (
        <div className='fichierstable'>

            <ListeFichiersEntete colonnes={colonnes} onClickEntete={props.onClickEntete} />

            {rows.map((row, idx)=>{
                const localId = idMapperFct(row, idx)
                const selected = selection.includes(localId)
                return (
                    <FichierItem
                        key={''+localId} 
                        modeView={modeView}
                        eventHandlers={eventHandlers}
                        colonnes={colonnes} 
                        data={row}
                        selected={selected}
                        idx={idx}
                        value={localId}
                        // onSelectioner={onSelectioner}
                        // onOuvrir={onOuvrir} 
                        // onContextMenu={onContextMenu}
                        // selectionne={selectionne}
                        // touchEnabled={touchEnabled}
                        // touchBegin={touchBegin}
                        >
                        
                    </FichierItem>
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
        <VisibilitySensor onChange={visibleSuivantCb} offset={{top: 50}} partialVisibility={true}>
            <Row className='section-suivante'>
                <Col>
                    <Button variant="secondary" onClick={visibleSuivantCb}><i className='fa fa-chevron-down'/></Button>
                </Col>
            </Row>
        </VisibilitySensor>
    )
}

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

function FichierItem(props) {

    const { 
        selected, idx, value, data,
        eventHandlers, modeView,
    } = props

    const colonnes = props.colonnes || {}
    const { rowLoader, rowClassname } = colonnes || {}
    const paramsColonnes = colonnes.paramsColonnes || {}

    const [dataRow, setDataRow] = useState(data)

    const {fileId, folderId} = dataRow
    const idMapperFct = colonnes.idMapper || idMapper
    const localId = idMapperFct(dataRow)

    let ClasseItem = useMemo(()=>{
        switch(modeView) {
            case 'thumbnails': return ListeFichiersThumbnails
            case 'thumbnails-small': return ListeFichiersThumbnails
            case 'recents': return ListeFichiersRecents
            default: 
                return ListeFichiersRow
        }
    }, [modeView])

    const classNames = useMemo(()=>{
        let classNames = ['fichierstablerow']
        if(selected) classNames.push('selectionne')
        if(rowClassname) {
            const rowClasses = rowClassname(dataRow)
            if(rowClasses) {
                classNames = [...classNames, ...rowClasses.split(' ')]
            }
        }
        return classNames
    }, [dataRow, selected, rowClassname])

    // Thumbnails
    const thumbnail = dataRow.thumbnail || {},
          {thumbnailIcon, thumbnailSrc} = thumbnail
    const thumbnailLoader = dataRow.imageLoader

    // const onContextMenuAction = useCallback(event=>{
    //     event.stopPropagation()
    //     if(eventHandlers.onContextMenu) eventHandlers.onContextMenu(event, {localId, fileId, folderId})
    // }, [eventHandlers, localId, fileId, folderId])

    // const onBoutonContext = useCallback(event=>{
    //     event.stopPropagation()
    //     event.preventDefault()
    //     if(eventHandlers.onContextMenu) eventHandlers.onContextMenu(event, {localId, fileId, folderId})
    // }, [eventHandlers])

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

    const fichierDesactive = !!data.disabled

    let actions = {...eventHandlers}
    if(!fichierDesactive) {
        // actions = {
        //     onDoubleClick: onDoubleClickAction,
        //     onContextMenu: onContextMenuAction,
        // }
    }

    return (
        <ClasseItem 
            selected={selected}
            idx={idx}
            value={value}
            data={dataRow}
            colonnes={colonnes}
            eventHandlers={actions}
        />
    )

    // return (
    //     <Row 
    //         className={classNames.join(' ')}
    //         {...actions}
    //         data-idx={idx}
    //         data-value={value}
    //     >
    //         {colonnes.ordreColonnes.map(nomColonne=>{
    //             const param = paramsColonnes[nomColonne]
    //             const classNameCol = param.className || ''
    //             const className = classNameCol || param.className
    //             const Formatteur = param.formatteur
    //             const showThumbnail = param.showThumbnail || false
    //             const showBoutonContexte = param.showBoutonContexte || false

    //             const contenu = dataRow[nomColonne] || ''
    //             let spanContenu = <span title={contenu}>{contenu}</span>
    //             if(Formatteur) {
    //                 spanContenu = <span><Formatteur value={contenu} data={dataRow} /></span>
    //             }

    //             let thumbnail = ''
    //             if(showThumbnail) {
    //                 if(thumbnailSrc || thumbnailLoader) {
    //                     thumbnail = <Thumbnail src={thumbnailSrc} loader={thumbnailLoader} mini={true} />
    //                 } else if(thumbnailIcon) {
    //                     thumbnail = <div className='thumbnailmini'>{thumbnailIcon}</div>
    //                 } else {
    //                     thumbnail = <div className='thumbnailmini'></div>
    //                 }
    //             }
    //             let boutonContexte = ''
    //             if(showBoutonContexte) {
    //                 if(fichierDesactive) {
    //                     boutonContexte = <span>X</span>
    //                 } else {
    //                     boutonContexte = (
    //                         <Button 
    //                             variant="secondary" 
    //                             size="sm" 
    //                             onClick={onBoutonContext} 
    //                             className='lignehover boutoncontexte'
    //                         >
    //                             <i className="fa fa-ellipsis-h"/>
    //                         </Button>
    //                     )
    //                 }
    //             }

    //             const infoDimension = {
    //                 xs: param.xs,
    //                 sm: param.sm,
    //                 md: param.md,
    //                 lg: param.lg,
    //                 xl: param.xl,
    //                 xxl: param.xxl,
    //             }

    //             if(boutonContexte) {
    //                 return (
    //                     <Col key={nomColonne} {...infoDimension} className={className}>
    //                         {boutonContexte}
    //                     </Col>
    //                 )
    //             }

    //             return (
    //                 <Col 
    //                     key={nomColonne} 
    //                     {...infoDimension} 
    //                     className={className}
    //                 >
    //                     {thumbnail}
    //                     {spanContenu}
    //                 </Col>
    //             )
    //         })}
    //     </Row>
    // )
}


function ListeFichiersRow(props) {

    const { selected, idx, value, data, eventHandlers } = props

    const colonnes = props.colonnes || {}
    const { rowClassname } = colonnes || {}
    const paramsColonnes = colonnes.paramsColonnes || {}

    const fichierDesactive = !!data.disabled

    const classNames = useMemo(()=>{
        let classNames = ['fichierstablerow']
        if(selected) classNames.push('selectionne')
        if(rowClassname) {
            const rowClasses = rowClassname(data)
            if(rowClasses) {
                classNames = [...classNames, ...rowClasses.split(' ')]
            }
        }
        return classNames
    }, [data, selected, rowClassname])

    // Thumbnails
    const thumbnail = data.thumbnail || {},
          {thumbnailIcon, thumbnailSrc} = thumbnail
    const thumbnailLoader = data.imageLoader

    return (
        <Row 
            className={classNames.join(' ')}
            {...eventHandlers}
            data-idx={idx}
            data-value={value}
        >
            {colonnes.ordreColonnes.map(nomColonne=>{
                const param = paramsColonnes[nomColonne]
                const classNameCol = param.className || ''
                const className = classNameCol || param.className
                const Formatteur = param.formatteur
                const showThumbnail = param.showThumbnail || false
                const showBoutonContexte = param.showBoutonContexte || false

                const contenu = data[nomColonne] || ''
                let spanContenu = <span title={contenu}>{contenu}</span>
                if(Formatteur) {
                    spanContenu = <span><Formatteur value={contenu} data={data} /></span>
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
                // if(showBoutonContexte) {
                //     if(fichierDesactive) {
                //         boutonContexte = <span>X</span>
                //     } else {
                //         boutonContexte = (
                //             <Button 
                //                 variant="secondary" 
                //                 size="sm" 
                //                 onClick={onBoutonContext} 
                //                 className='lignehover boutoncontexte'
                //             >
                //                 <i className="fa fa-ellipsis-h"/>
                //             </Button>
                //         )
                //     }
                // }

                const infoDimension = {
                    xs: param.xs,
                    sm: param.sm,
                    md: param.md,
                    lg: param.lg,
                    xl: param.xl,
                    xxl: param.xxl,
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
                    >
                        {thumbnail}
                        {spanContenu}
                    </Col>
                )
            })}
        </Row>
    )
}

function idMapper(row) {
    return row.localId || row.tuuid || row.fileId || row.folderId
}

function ListeFichiersThumbnails(props) {
    // const {
    //     rows, colonnes, 
    //     // onSelectioner, onOuvrir, onContextMenu, touchEnabled, touchBegin, 
    //     modeView, suivantCb,
    // } = props
    const { 
        rows, colonnes,
        selected, idx, value, data, 
        eventHandlers,
    } = props

    if(!rows) return ''  // Ecran n'est pas encore configure

    let modeSmall = ''
    if(modeView === 'thumbnails-small') modeSmall = true

    const selectionnes = props.selectionne || []
    // console.debug("ListeFichierThumbnails selectionnes : %O", selectionnes)
    const idMapperFct = colonnes.idMapper || idMapper

    return (
        <div>
            {rows.map(row=>{
                const localId = idMapperFct(row)
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
