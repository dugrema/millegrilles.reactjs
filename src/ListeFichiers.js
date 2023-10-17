import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {Container, Row, Col, Button, Modal} from 'react-bootstrap'
import VisibilitySensor from 'react-visibility-sensor'

import {Thumbnail, ThumbnailHeader, ThumbnailFooter, ThumbnailBoutonContexte} from './Thumbnail'
import { isTouchEnabled } from './detecterAppareils'
import { FormatterDate, FormatterDuree } from './Formatters'
import { estMimetypeVideo } from '@dugrema/millegrilles.utiljs/src/mimetypes.js'

const MIMETYPE_PDF = 'application/pdf'

const TOUCH_ENABLED = isTouchEnabled()  // Detecter touch (appareil mobile)

export function ListeFichiers(props) {
    // Selectionner mode de liste (desktop ou mobile) selon presence des evenements touch
    if(TOUCH_ENABLED) return ListeFichiersMobile(props)
    return ListeFichiersDesktop(props)
}

function ListeFichiersDesktop(props) {

    // Intercepter onClick pour capturer la selection
    const { 
        modeView, rows, isListeComplete, colonnes, modeSelectionActif, selection, 
        onContextMenu, onSelect, scrollValue, 
        onScroll, onOpen, onClickEntete,
        suivantCb, capabilities,
    } = props

    const [idxSelectionShift, setIdxSelectionShift] = useState(0)
    const [scrollRestored, setScrollRestored] = useState(false)

    const contextMenuHandler = useCallback( async e => {
        e.stopPropagation()
        e.preventDefault()
        const value = e.currentTarget.dataset.value
        if(onSelect) {
            if(!selection || !selection.includes(value)) {
                // On reselectionne l'element courant
                onSelect([value])
            }
        }
        if(onContextMenu) onContextMenu(e, value)
    }, [onContextMenu, onSelect, selection, rows, onSelect])

    const ouvrirItemHandler = useCallback(e=>{
        const { idx, value } = e.currentTarget.dataset
        setIdxSelectionShift(idx)
        if(onSelect) onSelect([value])
        if(onOpen) onOpen(rows[idx])
    }, [rows, setIdxSelectionShift, onSelect, onOpen])

    const selectionToggleHandler = useCallback(e=>{
        const {shiftKey, ctrlKey} = e
        const { idx, value } = e.currentTarget.dataset
        // console.debug("Selection handler idx:%O, value:%O, ctrl:%s, shift:%s", idx, value, ctrlKey, shiftKey)

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

            // console.debug("Ajouter range %d -> %d (liste %O)", debut, fin, rows)
            
            const idMapperFct = colonnes.idMapper || idMapper
            const selectionMaj = [...selection]
            for(let i=debut; i<=fin; i++) {
                const valueAdd = idMapperFct(rows[i])
                // console.debug("Ajouter idx:%s : %s", i, valueAdd)
                if(!selectionMaj.includes(valueAdd)) selectionMaj.push(valueAdd)
            }

            if(onSelect) onSelect(selectionMaj)

        } else if(modeSelection) {
            if(!shiftKey) setIdxSelectionShift(idx)

            // Reset selection cumulee
            if( selection.includes(value) ) {
                // Deselectionner
                const selectionMaj = selection.filter(item=>item!==value)
                if(onSelect) onSelect(selectionMaj)
            } else {
                // Selectionner
                if(onSelect) onSelect([...selection, value])
            }

        } else {
            setIdxSelectionShift(idx)
            if(onSelect) onSelect([value])
        }

    }, [rows, selection, idxSelectionShift, modeSelectionActif, onSelect, setIdxSelectionShift])

    const eventHandlers = useMemo(()=>{
        // PC
        return {
            onClick: selectionToggleHandler, 
            onDoubleClick: ouvrirItemHandler,
            onContextMenu: contextMenuHandler,
        }
    }, [selectionToggleHandler, ouvrirItemHandler])

    useEffect(()=>{
        if(scrollRestored) return
        setScrollRestored(true)
        if(scrollValue > 0) window.scroll({top: scrollValue})
    }, [scrollValue, scrollRestored, setScrollRestored])

    useEffect(() => {
        const onScrollHandler = (e) => {
            const pos = e.target.documentElement.scrollTop
            if(onScroll) onScroll(pos)
        };
        window.addEventListener('scroll', onScrollHandler);
        return () => window.removeEventListener('scroll', onScrollHandler);
    }, [onScroll])

    return (
        <div>
            <ListeFichiersItemsDesktop 
                modeView={modeView}
                rows={rows} 
                isListeComplete={isListeComplete}
                colonnes={colonnes}
                selection={selection}
                eventHandlers={eventHandlers} 
                onClickEntete={onClickEntete}
                suivantCb={suivantCb} />
        </div>
    )
}

function ListeFichiersMobile(props) {

    // Intercepter onClick pour capturer la selection
    const { 
        modeView, rows, isListeComplete, colonnes, modeSelection: modeSelectionActif, selection: selectionActif,
        onContextMenu, onSelect, scrollValue, 
        onScroll, onOpen, onClickEntete,
        suivantCb, capabilities,
    } = props

    // console.debug("ListeFichiersMobile proppies ", props)

    const selection = useMemo(()=>{
        if(selectionActif) return selectionActif
        return []
    }, [selectionActif])

    const [idxSelectionShift, setIdxSelectionShift] = useState(0)
    const [touchEvent, setTouchEvent] = useState('')
    const [scrollRestored, setScrollRestored] = useState(false)
    const [longTouchTimer, setLongTouchTimer] = useState('')

    const ouvrirItemHandler = useCallback(e=>{
        const { idx, value } = e.currentTarget.dataset
        setIdxSelectionShift(idx)
        if(onSelect) onSelect([value])
        if(onOpen) onOpen(rows[idx])
    }, [rows, setIdxSelectionShift, onSelect, onOpen])

    const selectionToggleHandler = useCallback(e=>{
        const {shiftKey, ctrlKey} = e
        const { idx, value } = e.currentTarget.dataset
        // console.debug("Selection handler idx:%O, value:%O, ctrl:%s, shift:%s", idx, value, ctrlKey, shiftKey)

        // Mode selection - soit touche CTRL (PC) ou toggle sur mobile
        const modeSelection = modeSelectionActif || ctrlKey

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

            // console.debug("Ajouter range %d -> %d (liste %O)", debut, fin, rows)
            
            const idMapperFct = colonnes.idMapper || idMapper
            const selectionMaj = [...selection]
            for(let i=debut; i<=fin; i++) {
                const valueAdd = idMapperFct(rows[i])
                // console.debug("Ajouter idx:%s : %s", i, valueAdd)
                if(!selectionMaj.includes(valueAdd)) selectionMaj.push(valueAdd)
            }

            if(onSelect) onSelect(selectionMaj)

        } else if(modeSelection) {
            if(!shiftKey) setIdxSelectionShift(idx)

            // Reset selection cumulee
            if( selection.includes(value) ) {
                // Deselectionner
                const selectionMaj = selection.filter(item=>item!==value)
                if(onSelect) onSelect(selectionMaj)
            } else {
                // Selectionner
                if(onSelect) onSelect([...selection, value])
            }

        } else {
            setIdxSelectionShift(idx)
            if(onSelect) onSelect([value])
        }

    }, [rows, selection, idxSelectionShift, modeSelectionActif, onSelect, setIdxSelectionShift])

    const touchStartHandler = useCallback(e=>{
        e.preventDefault()
        if(e.touches.length > 1) {
            // Touch supplementaires cancel
            setTouchEvent('')
            if(longTouchTimer) clearTimeout(longTouchTimer)
            setLongTouchTimer('')
            return
        }

        const dataset = e.currentTarget.dataset || e.parentElement.dataset
        const item = {...dataset}
        const value = dataset.value
        let eventTouches = {}
        if(e.targetTouches) {
            const { clientX, clientY } = e.targetTouches[0]
            eventTouches = {clientX, clientY}
        }

        // console.debug("Set touch event item %O, event %O", item, e)
        setTouchEvent(item)

        if(!modeSelectionActif) {
            const timer = setTimeout(()=>{
                setTouchEvent('')
                if(onContextMenu) {
                    // console.debug("Context menu %O, %O, %O", eventTouches, e, value)
                    if(onSelect) onSelect([value])
                    onContextMenu(eventTouches, value)
                    window.getSelection().removeAllRanges()
                    setLongTouchTimer(false)  // Flag pour empecher de-select sur end touch
                } else {
                    setLongTouchTimer('')
                }
            }, 800)
            setLongTouchTimer(timer)
        }
    }, [onContextMenu, modeSelectionActif, setTouchEvent, longTouchTimer, setLongTouchTimer])

    const touchMoveHandler = useCallback(e=>{
        e.preventDefault()
        // console.debug("Move, reset")
        setTouchEvent('')  // Reset
        if(longTouchTimer) clearTimeout(longTouchTimer)
        setLongTouchTimer('')
    }, [setTouchEvent, longTouchTimer, setLongTouchTimer])

    const touchEndHandler = useCallback(e=>{
        e.preventDefault()
        // console.debug("end - touch event : ", touchEvent)

        // Reset
        setTouchEvent('')
        if(longTouchTimer) clearTimeout(longTouchTimer)
        window.getSelection().removeAllRanges()

        if(touchEvent) {
            const eventSimule = {currentTarget: {dataset: touchEvent}}
            if(modeSelectionActif) {
                selectionToggleHandler(eventSimule)
            } else {
                ouvrirItemHandler(eventSimule)
            }
        } else {
            if(!modeSelectionActif && longTouchTimer !== false) {
                if(onSelect) onSelect('')
            }
            setLongTouchTimer('')
        }
    }, [modeSelectionActif, touchEvent, setTouchEvent, ouvrirItemHandler, selectionToggleHandler, 
        onSelect, longTouchTimer, setLongTouchTimer])

    const eventHandlers = useMemo(()=>{
        // Mobile
        return {
            onTouchStart: touchStartHandler,
            onTouchMove: touchMoveHandler,
            onTouchEnd: touchEndHandler,
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
            <ListeFichiersItemsMobile 
                modeView={modeView}
                rows={rows} 
                isListeComplete={isListeComplete}
                colonnes={colonnes}
                selection={selection}
                eventHandlers={eventHandlers} 
                onClickEntete={onClickEntete}
                suivantCb={suivantCb} />
        </div>
    )
}

/** Liste de fichiers avec details sur lignes, colonnes configurables */
function ListeFichiersItemsDesktop(props) {

    // console.debug("!!! ListeFichiersItems proppies ", props)

    const {
        modeView, colonnes, rows, 
        eventHandlers, 
        isListeComplete, suivantCb,
        onClickEntete,
    } = props

    if(!colonnes || !rows) return ''  // Ecran n'est pas encore configure

    const selection = props.selection || []

    const idMapperFct = colonnes.idMapper || idMapper

    const labelFooter = useMemo(()=>{
        if(!rows) return ''
        if(rows.length === 0 && isListeComplete) return (
            <span>Collection vide</span>
        )
        if(rows.length === 1) return (
            <span>{isListeComplete?'Liste complete, ':''} 1 item affiche</span>
        )
        return (
            <span>{isListeComplete?'Liste complete, ':''} {rows.length} items affiches</span>
        )
    }, [isListeComplete, rows])

    return (
        <div className='fichierstable'>

            <ListeFichiersEntete colonnes={colonnes} onClickEntete={onClickEntete} />

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
                        >
                        
                    </FichierItem>
                )
            })}

            {isListeComplete?'':
                <BoutonSuivantListe suivantCb={suivantCb} />
            }

            <p className='listefichiers-footer'>{labelFooter}</p>

        </div>
    )
}

/** Liste de fichiers avec details sur lignes, colonnes configurables */
function ListeFichiersItemsMobile(props) {

    // console.debug("!!! ListeFichiersItems proppies ", props)

    const {
        modeView, colonnes, rows, 
        eventHandlers, 
        isListeComplete, suivantCb,
        onClickEntete,
    } = props

    if(!colonnes || !rows) return ''  // Ecran n'est pas encore configure

    const selection = props.selection || []

    const idMapperFct = colonnes.idMapper || idMapper

    const labelFooter = useMemo(()=>{
        if(!rows) return ''
        if(rows.length === 0 && isListeComplete) return (
            <span>Collection vide</span>
        )
        if(rows.length === 1) return (
            <span>{isListeComplete?'Liste complete, ':''} 1 item affiche</span>
        )
        return (
            <span>{isListeComplete?'Liste complete, ':''} {rows.length} items affiches</span>
        )
    }, [isListeComplete, rows])

    return (
        <div className='fichierstable'>

            <ListeFichiersEntete colonnes={colonnes} onClickEntete={onClickEntete} />

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
                        >
                        
                    </FichierItem>
                )
            })}

            {isListeComplete?'':
                <BoutonSuivantListe suivantCb={suivantCb} />
            }

            <p className='listefichiers-footer'>{labelFooter}</p>

        </div>
    )
}

function BoutonSuivantListe(props) {

    const { suivantCb } = props

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
            case 'thumbnails': return FichierThumbnail
            case 'thumbnails-small': return FichierThumbnail
            case 'recents': return ListeFichiersRecents
            default:
                if(TOUCH_ENABLED) return ListeFichiersRowMobile
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
    // const thumbnail = dataRow.thumbnail || {},
    //       {thumbnailIcon, thumbnailSrc} = thumbnail
    // const thumbnailLoader = dataRow.imageLoader

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

}


function ListeFichiersRow(props) {

    const { selected, idx, value, data, eventHandlers } = props

    // console.debug("ListeFichiersRow proppies : ", props)

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
    const thumbnailLoader = data.thumbnailLoader

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

                const infoDimension = {
                    xs: param.xs,
                    sm: param.sm,
                    md: param.md,
                    lg: param.lg,
                    xl: param.xl,
                    xxl: param.xxl,
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

function ThumbnailMobile(props) {
    if(props.src || props.loader) {
        return <Thumbnail src={props.src} loader={props.loader} small={true} />
    } else if(props.icon) {
        return <div className='thumbnailsmall'>{props.icon}</div>
    } else {
        return <div className='thumbnailsmall'></div>
    }

}

function ListeFichiersRowMobile(props) {

    const { selected, idx, value, data, eventHandlers } = props

    // console.debug("ListeFichiersRowMobile proppies ", props)

    const colonnes = props.colonnes || {}
    const { rowClassname } = colonnes || {}
    const paramsColonnes = colonnes.paramsColonnesMobile || colonnes.paramsColonnes || {}
    const ordreColonnes = colonnes.ordreColonnesMobile || colonnes.ordreColonnes || {}

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
    const thumbnailLoader = data.thumbnailLoader

    return (
        <Row 
            className={classNames.join(' ')}
            {...eventHandlers}
            data-idx={idx}
            data-value={value}
        >
            <Col xs={3} sm={2}>
                <ThumbnailMobile src={thumbnailSrc} loader={thumbnailLoader} icon={thumbnailIcon} />
            </Col>

            <Col xs={9} sm={10}>
                <Row>
                    {ordreColonnes.map(nomColonne=>{
                        const param = paramsColonnes[nomColonne]
                        const classNameCol = param.className || ''
                        const className = classNameCol || param.className
                        const Formatteur = param.formatteur

                        const contenu = data[nomColonne] || ''
                        let spanContenu = <span title={contenu}>{contenu}</span>
                        if(Formatteur) {
                            spanContenu = <span><Formatteur value={contenu} data={data} /></span>
                        }

                        const infoDimension = {
                            xs: param.xs,
                            sm: param.sm,
                            md: param.md,
                            lg: param.lg,
                            xl: param.xl,
                            xxl: param.xxl,
                        }

                        return (
                            <Col 
                                key={nomColonne} 
                                {...infoDimension} 
                                className={className}
                            >
                                {spanContenu}
                            </Col>
                        )
                    })}
                </Row>
            </Col>

        </Row>
    )
}

function idMapper(row) {
    return row.localId || row.tuuid || row.fileId || row.folderId
}

function FichierThumbnail(props) {

    const { selected, idx, value, data, eventHandlers, small } = props

    const { duration } = data
    const thumbnail = data.thumbnail || {},
          { thumbnailIcon, thumbnailSrc, thumbnailCaption } = thumbnail

    const thumbnailLoader = useMemo(()=>{
        if(!data) return
        return data.thumbnailLoader
    }, [data])

    const className = useMemo( () => {
        const classNames = []
        if(selected) classNames.push('selectionne')
        return classNames.join(' ')
    }, [selected])
    
    return (
        <Thumbnail
            {...eventHandlers}    
            src={thumbnailSrc}
            loader={thumbnailLoader}
            placeholder={thumbnailIcon}
            className={className}
            small={small}
            idx={idx}
            value={value}
        >

            {duration?
                <ThumbnailHeader>
                    <span className='fa fa-play'/>{' '}
                    <FormatterDuree value={duration} />
                </ThumbnailHeader>            
                :''
            }

            <ThumbnailFooter>{thumbnailCaption}</ThumbnailFooter>

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
        <Row className='fichierstable'>
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
        </Row>
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
              baseType = mimetype.split('/').shift(),
              estVideo = estMimetypeVideo(mimetype)
        if(mimetype === MIMETYPE_PDF) typeFichier = 'document'
        else if(baseType === 'image' || estVideo) typeFichier = 'media'
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
