import React, {useState, useEffect} from 'react'
import {Button, Card} from 'react-bootstrap'
import styles from './styles.module.css'

export function Thumbnail(props) {
    const { mini, small } = props
    
    let styleBase, labelImage = 'small'
    if(small) {
        styleBase = styles.thumbnailsmall
    } else if(mini) {
        styleBase = styles.thumbnailmini
        labelImage = 'thumb'
    } else {
        styleBase = styles.thumbnail
    }

    const className = [styleBase, (props.className || '')].join(' ')
    const {src, loader, placeholder} = props
    const {onClick, onDoubleClick, onContextMenu, onTouchStart, onTouchMove, onTouchEnd} = props

    const [imgSrc, setImgSrc] = useState(src)

    // Declencher loader si present
    useEffect(()=>{
        if(!loader) return  // Rien a faire

        // Executer le loader
        loader.load(labelImage, setImgSrc)
            .then(setImgSrc)
            .catch(err => console.error("Thumbnail Erreur chargement image : %O", err))

        // Retourne unloader pour nettoyer le composant
        if(loader.unload) return () => loader.unload(labelImage)
    }, [loader, labelImage])

    return (
        <Card 
            onClick={onClick} 
            onDoubleClick={onDoubleClick} 
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd} 
            onContextMenu={onContextMenu} 
            className={className}
            >

            <Card.Img src={imgSrc}/>
            {props.children?
                <Card.ImgOverlay>
                    {imgSrc?'':placeholder}
                    {props.children}
                </Card.ImgOverlay>
                :''
            }

        </Card>
    )
}

export function ThumbnailHeader(props) {
    return (
        <div className={styles.thumbnailheader}>
            {props.children}
        </div>
    )
}

export function ThumbnailFooter(props) {
    return (
        <div className={styles.thumbnailfooter}>
            {props.children}
        </div>
    )
}

export function ThumbnailBoutonContexte(props) {
    const { onClick } = props
    return (
        <Button 
            variant="secondary" 
            onClick={onClick} 
            className={styles.thumbnailboutoncontexte}>
        
            <span className="fa fa-ellipsis-h"/>
        
        </Button>
    )
}
