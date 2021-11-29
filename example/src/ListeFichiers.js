import React, {useState, useEffect, useCallback} from 'react'
import { Container, Row, Col, Button } from 'react-bootstrap'
import { ListeFichiers, MenuContextuel, FormatteurTaille, FormatterDate } from 'millegrilles.reactjs'

const ICONE_FOLDER = <i className="fa fa-folder fa-lg"/>
const ICONE_FICHIER = <i className="fa fa-file fa-lg"/>
const ICONE_FICHIER_PDF = <i className="fa fa-file-pdf-o fa-lg"/>
const ICONE_FICHIER_IMAGE = <i className="fa fa-file-image-o fa-lg"/>
const ICONE_FICHIER_AUDIO = <i className="fa fa-file-audio-o fa-lg"/>
const ICONE_FICHIER_VIDEO = <i className="fa fa-file-video-o fa-lg"/>
const ICONE_FICHIER_TEXT = <i className="fa fa-file-text-o fa-lg"/>
const ICONE_FICHIER_ZIP = <i className="fa fa-file-zip-o fa-lg"/>
const ICONE_QUESTION = <i className="fa fa-question fa-lg"/>

export default props => {

    const [colonnes, setColonnes] = useState('')
    const [data, setData] = useState('')
    const [selectionLignes, setSelectionLignes] = useState('')
    const [selectionThumbs, setSelectionThumbs] = useState('')
    const [ouvrirId, setOuvrirId] = useState('')

    useEffect(()=>{
        const sampleData = sampleData1().map(mapper)
        setData(sampleData)
        console.debug("Sample data : %O", sampleData)

        const colonnes = preparerColonnes()
        setColonnes(colonnes)
        console.debug("Colonnes : %O", colonnes)
    }, [])

    const [contextuel, setContextuel] = useState({show: false, x: 0, y: 0})

    const onDoubleClick = useCallback((event, value)=>{
        window.getSelection().removeAllRanges();
        console.debug("Ouvrir %O", value)
        setOuvrirId(value.fileId || value.folderId)
    }, [setOuvrirId])

    const onSelectionLignes = useCallback(selection=>{setSelectionLignes(selection.join(', '))}, [setSelectionLignes])
    const onSelectionThumbs = useCallback(selection=>{setSelectionThumbs(selection.join(', '))}, [setSelectionThumbs])

    const fermerContextuel = useCallback(()=>{
        setContextuel(false)
    }, [setContextuel])

    return (
        <Container>

            <p>
                Ma page container avec bein du texte pour voir ce qui se passe.
            </p>

            <h2>Liste fichiers mode lignes</h2>

            <ListeFichiers 
                colonnes={colonnes}
                rows={data} 
                onClick={onClick} 
                onDoubleClick={onDoubleClick}
                onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
                onSelection={onSelectionLignes}
                onClickEntete={colonne=>{console.debug("Entete click : %s", colonne)}}
                />

            <p>Selection : {selectionLignes}</p>
            <p>Ouvrir: {ouvrirId}</p>

            <h2>Liste fichiers mode thumbnails</h2>
            <ListeFichiers 
                modeView='thumbnails' 
                colonnes={colonnes}
                rows={data} 
                onClick={onClick} 
                onDoubleClick={onDoubleClick}
                onContextMenu={(event, value)=>onContextMenu(event, value, setContextuel)}
                onSelection={onSelectionThumbs}
                onClickEntete={colonne=>{console.debug("Entete click : %s", colonne)}}
                />

            <p style={{clear: 'left'}}>
                Selection : {selectionThumbs}
            </p>

            <MenuContextuel show={contextuel.show} posX={contextuel.x} posY={contextuel.y} fermer={fermerContextuel}>
                <Row><Col><Button variant="link" onClick={fermerContextuel}><i className="fa fa-search"/> Preview</Button></Col></Row>
                <Row><Col><Button variant="link" onClick={fermerContextuel}><i className="fa fa-download"/> Download</Button></Col></Row>
                <hr/>
                <Row><Col><Button variant="link" onClick={fermerContextuel}><i className="fa fa-info-circle"/> Info</Button></Col></Row>
                <Row><Col><Button variant="link" onClick={fermerContextuel}><i className="fa fa-star"/> Favorite</Button></Col></Row>
                <hr/>
                <Row><Col><Button variant="link" onClick={fermerContextuel}><i className="fa fa-edit"/> Rename</Button></Col></Row>
                <Row><Col><Button variant="link" onClick={fermerContextuel}><i className="fa fa-cut"/> Move</Button></Col></Row>
                <Row><Col><Button variant="link" onClick={fermerContextuel}><i className="fa fa-copy"/> Copy</Button></Col></Row>
                <Row><Col><Button variant="link" onClick={fermerContextuel}><i className="fa fa-remove"/> Remove</Button></Col></Row>
            </MenuContextuel>

        </Container>
    )
}

function preparerColonnes() {
    const params = {
        ordreColonnes: ['favoris', 'nom', 'mimetype', 'taille', 'dateAjout', 'boutonDetail'],
        paramsColonnes: {
            'favoris': {'label': 'FV', className: 'favoris', xs: 1, lg: 1}, 
            'nom': {'label': 'Nom', showThumbnail: true, xs: 11, lg: 5},
            'taille': {'label': 'Taille', className: 'details', formatteur: FormatteurTaille, xs: 3, lg: 1},
            'mimetype': {'label': 'Type', className: 'details', xs: 3, lg: 2},
            'dateAjout': {'label': 'Date ajout', className: 'details', formatteur: FormatterDate, xs: 5, lg: 2},
            'boutonDetail': {label: ' ', className: 'details', showBoutonContexte: true, xs: 1, lg: 1},
        },
        tri: {colonne: 'nom', ordre: 1},
    }
    return params
}

function sampleData1() {
    return [
        {fuuid: 'abcd-1234', nom: 'fichier1.jpg', taille: 1234, date: 1637264900, mimetype: 'image/jpg', thumbnailSrc: '/res/001_128.jpg'},
        {fuuid: 'abcd-1235', nom: 'fichier2 avec un nom long.jpg', taille: 2938481, date: 1637264901, mimetype: 'image/jpg', thumbnailLoader: loadImage()},
        {fuuid: 'abcd-1236', nom: 'fichier3 avec un nom encore plus long que lautre pour depasser la limite de lecran.jpg', taille: 10023, date: 1637264902, mimetype: 'image/jpg'},
        {fuuid: 'abcd-1237', nom: 'article1.pdf', taille: 84511, date: 1637265416, mimetype: 'application/pdf'},
        {fuuid: 'abcd-1238', nom: 'mon film 1.mov', taille: 134874998, date: 1637278941, mimetype: 'video/qt', duree: 123},
        {cuuid: 'efgh-5678', nom: 'Repertoire 1', date: 1637264902},
    ]
}

function mapper(row) {
    const {cuuid, fuuid, nom, taille, date, mimetype, thumbnailLoader, thumbnailSrc, duree} = row

    let thumbnailIcon = ''
    if(!thumbnailLoader && !thumbnailSrc) {
        if(cuuid) {
            thumbnailIcon = ICONE_FOLDER
        } else if(fuuid) {
            const mimetypeBase = mimetype.split('/').shift()

            if(mimetype === 'application/pdf') {
                thumbnailIcon = ICONE_FICHIER_PDF
            } else if(mimetypeBase === 'image') {
                thumbnailIcon = ICONE_FICHIER_IMAGE
            } else if(mimetypeBase === 'video') {
                thumbnailIcon = ICONE_FICHIER_VIDEO
            } else if(mimetypeBase === 'audio') {
                thumbnailIcon = ICONE_FICHIER_AUDIO
            } else if(mimetypeBase === 'application/text') {
                thumbnailIcon = ICONE_FICHIER_TEXT
            } else if(mimetypeBase === 'application/zip') {
                thumbnailIcon = ICONE_FICHIER_ZIP
            } else { 
                thumbnailIcon = ICONE_FICHIER
            }
        } else {
            thumbnailIcon = ICONE_QUESTION
        }
    }

    return {
        fileId: fuuid,
        folderId: cuuid,
        nom,
        taille,
        dateAjout: date,
        mimetype: cuuid?'Repertoire':mimetype,
        thumbnailSrc,
        thumbnailLoader,
        thumbnailIcon,
        thumbnailCaption: nom,
        duree,
    }
}

function onClick(event, value) {
    console.debug("Click %O", value)
    return false
}

// function onDoubleClick(event, value) {
//     window.getSelection().removeAllRanges();
//     console.debug("Double-Click %O", value)
// }

function onContextMenu(event, value, setContextuel) {
    event.preventDefault()
    const {clientX, clientY} = event
    console.debug("ContextMenu %O (%d, %d)", value, clientX, clientY)

    const params = {show: true, x: clientX, y: clientY}

    setContextuel(params)
}

function loadImage() {
    return {
        load: async setSrc => {
            setSrc('/res/001_128.jpg')
            await new Promise(resolve=>{setTimeout(resolve, 2000)})
            setSrc('/res/002_200.jpg')
        },
        unload: () => console.debug("Unload")
    }
}