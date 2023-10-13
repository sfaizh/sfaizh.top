

const Header = props => {

    return (
        <div className="blank-header">
            {/* <img src="/img/1641368271683.jpg"></img> */}
            <div className="row header-span justify-content-center pt-5">
                    <h1><a href="/">60% of the time, it works every time</a></h1>
            </div>
            <div className="row">
                <div className="navbar navbar-expand-lg navbar-dark justify-content-center">
                    {/* <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button> */}
                    {/* <div className="collapse navbar-collapse" id="navbarNav"> */}
                        <ul className="navbar-nav">
                            <li className="nav-item">
                                <a className="nav-link disabled" href="/blog">Blog</a>
                            </li>
                            <li className={`nav-item ${(props.current == "Cars") ? "active" : ""}`}>
                                <a className="nav-link" href="/motorsports">Motorsports <span className="sr-only">(current)</span></a>
                            </li>
                            <li className={`nav-item ${(props.current == "Weightlifting") ? "active" : ""}`}>
                                <a className="nav-link disabled" href="/weightlifting">Weightlifting</a>
                            </li>
                            <li className={`nav-item ${(props.current == "Travelling") ? "active" : ""}`}>
                                <a className="nav-link disabled" href="/travelling">Travelling</a>
                            </li>
                            <li className={`nav-item ${(props.current == "Industry Experience") ? "active" : ""}`}>
                                <a className="nav-link" href="/industry">Industry Experience</a>
                            </li>
                        </ul>
                    {/* </div> */}
                </div>

            </div>
        </div>
    );
}

export default Header;