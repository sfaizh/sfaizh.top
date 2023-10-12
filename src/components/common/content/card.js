
// Posts content
const Card = props => {
    return (
        <div className="card-wrapper" id={"v-pills-" + props.id}>
            <div className="card-header">
                <div className="row">
                    <div className="col-6">
                        <div className="card-title">
                            <pre>{props.title}</pre>
                        </div>
                        <div className="card-subtitle">
                            <pre>{props.subtitle}</pre>
                        </div>
                    </div>
                    <div className="col-6">
                        <img height={props.logo_size} src={props.logo} />
                    </div>
                </div>
            </div>
            <div className="card-body">
                <pre>{props.body}</pre>
                <div className="row pb-3">
                    <div className={"col text-center " + ((!props.img_alt) ? "hidden-card":"")}><img height="150px" src={props.img_alt} /></div>
                    <div className={"col text-center " + ((!props.img_alt1) ? "hidden-card":"")}><img height="150px" src={props.img_alt1} /></div>
                    <div className={"col text-center " + ((!props.img_alt2) ? "hidden-card":"")}><img height="150px" src={props.img_alt2} /></div>
                </div>
                <div className="row">
                    <div className={"col text-center " + ((!props.img_alt3) ? "hidden-card":"")}><img height="150px" src={props.img_alt3} /></div>
                    <div className={"col text-center " + ((!props.img_alt4) ? "hidden-card":"")}><img height="150px" src={props.img_alt4} /></div>
                    <div className={"col text-center " + ((!props.img_alt5) ? "hidden-card":"")}><img height="150px" src={props.img_alt5} /></div>
                </div>

                {/* <div className="text-center"><img height="200px" src={props.img_alt1} /></div>
                {/* Photo Grid */}
            </div>
            <div className="card-footer">
                <pre>{props.footer}</pre>
            </div>
        </div>
    );
}

export default Card;