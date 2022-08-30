import React, {useState, useEffect, useCallback} from 'react'

import Container from 'react-bootstrap/Container'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Breadcrumb from 'react-bootstrap/Breadcrumb'
import Button from 'react-bootstrap/Button'

export default props => {

    const { 
        // loadCollection, setPath: setPathOut, 
        nomRoot,
        liste, breadcrumb, toBreadrumbIdx, toCollection,
    } = props

    const nomRootLocal = nomRoot || 'Favoris'

    // const [ cuuidCourant, setCuuidCourant ] = useState('')
    // const [ path, setPath ] = useState([])
    // const [ liste, setListe ] = useState([])

    // const activeIdx = path.length - 1

    const ouvrirCuuid = useCallback( event => {
        event.stopPropagation()
        event.preventDefault()
        
        const cuuid = event.currentTarget.value
        Promise.resolve(toCollection(cuuid))
            .catch(err=>console.error("Erreur changement collection ", err))
        
        // const collection = liste.filter(item=>item.tuuid === cuuid).pop()
        // if(collection) {
        //     const nouveauPath = [...path, collection]
        //     // console.debug("Path update : %O", nouveauPath)
        //     setPath(nouveauPath)
        // }

    }, [toCollection])

    // const backPath = useCallback( path => { 
    //     // console.debug("Back %O", path)
    //     setPath(path) 
    // }, [setPath])

    // useEffect(()=>{
    //     const collectionCourante = path[path.length-1]
    //     const tuuidCourant = collectionCourante?collectionCourante.tuuid:''
    //     setCuuidCourant(tuuidCourant)
    //     setPathOut(path.map(item=>item.tuuid))
    // }, [path, setCuuidCourant, setPathOut])

    // useEffect(()=>{
    //     if(!loadCollection || !setListe) return
    //     else {
    //         loadCollection(cuuidCourant)
    //         .then(liste=>{
    //             // console.debug("Cuuid %s, liste collections : %O", cuuidCourant, liste)
    //             liste.sort(trierNom)
    //             setListe(liste)
    //         })
    //         .catch(err=>{
    //             console.error("Erreur load collection %s : %O", cuuidCourant, err)
    //         })
    //     }
    // }, [loadCollection, cuuidCourant, setListe])

    // let pathCumulatif = []

    return (
        <Container className="filepicker">
            <SectionBreadcrumb 
                nomRootLocal={nomRootLocal}
                breadcrumb={breadcrumb}
                toBreadrumbIdx={toBreadrumbIdx}
              />

            <AfficherListeCollections 
                liste={liste}
                ouvrirCuuid={ouvrirCuuid}
              />

        </Container>
    )
}

function SectionBreadcrumb(props) {

    const { nomRootLocal, breadcrumb, toBreadrumbIdx } = props

    const handlerSliceBreadcrumb = useCallback(event => {
        event.preventDefault()
        event.stopPropagation()

        const idx = event.currentTarget.dataset.idx
        Promise.resolve(toBreadrumbIdx(idx))
            .catch(err=>console.error("SectionBreadcrumb Erreur ", err))
    }, [breadcrumb, toBreadrumbIdx])

    return (
        <Breadcrumb>
            
            <Breadcrumb.Item onClick={handlerSliceBreadcrumb}>{nomRootLocal}</Breadcrumb.Item>
            
            {breadcrumb.map((item, idxItem)=>{
                // Dernier
                if(idxItem === breadcrumb.length - 1) {
                    return <span key={idxItem}>&nbsp; / {item.label}</span>
                }
                
                // Parents
                return (
                    <Breadcrumb.Item key={idxItem} onClick={handlerSliceBreadcrumb} data-idx={''+idxItem}>
                        {item.label}
                    </Breadcrumb.Item>
                )
            })}

        </Breadcrumb>
    )

}

function AfficherListeCollections(props) {

    // console.debug("AfficherListeCollections Proppys %O", props)

    const liste = props.liste || []
    const ouvrirCuuid = props.ouvrirCuuid

    return (
        <div className="liste">
            {liste.map( item => (
                <Row key={item.tuuid}>
                    <Col>
                        <Button variant="link" onClick={ouvrirCuuid} value={item.tuuid}>
                            {item.nom}
                        </Button>
                    </Col>
                </Row>
            ))}
        </div>
    )
}

function trierNom(a, b) {
    if(a===b) return 0
    const aNom = a.nom || '', bNom = b.nom || ''
    return aNom.localeCompare(bNom)
}