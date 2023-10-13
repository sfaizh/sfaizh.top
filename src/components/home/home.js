import React, { useEffect, useState } from 'react';
import Header from "../common/header";
import Footer from "../common/footer.js";
import "../home/home.css";

let _isMounted = false;

const Home = () => {

    useEffect(()  => {
        _isMounted = true;
        return () => { _isMounted = false };
    });

    return (
        <div className="home-wrapper">
            <div className="container-fluid header-wrapper text-center">
                <div className="row">
                    <Header current={"Home"}/>
                </div>
            </div>
            <div className="container page-wrapper p-3">
                <div className="row justify-content-center">
                    <div className="col-8 intro-section">
                        <p>Welcome to my portfolio</p>
                        <p>My name is Faizan. I moved to Australia with my parents when I was 7 years old. I got my first computer a few years later
                            and ever since have been intrigued with information communication systems.
                        </p>
                        <p>Want to discuss a project or just want to have a chat? You can reach me through <a target="_blank" href="https://www.linkedin.com/in/sfaizanh/">LinkedIn</a> or <a href="mailto:faizanh53@gmail.com">Email</a></p>
                    </div>
                </div>
                <div className="row edu-section justify-content-center">
                    <div className="col-6 intro-section">
                        <p>EDUCATION</p>
                        <p>GRADUATE SOFTWARE ENGINEERING STUDENT, UNIVERSITY OF TECHNOLOGY, SYDNEY</p>
                        <p>Bachelor of Engineering, Diploma in Professional Engineering Practice (ICTE Software)</p>
                    </div>
                    <div className="col-2 intro-section">
                        <img height="125px" src="/img/uts-logo.jpg" />
                    </div>
                </div>
                <div className="row about-section justify-content-center">
                    <div className="col-8">
                        <p>ABOUT ME</p>
                        <p>Software Engineer with 4 years of experience working in the developer/IT sector with both local and international organisations.
                            Working alongside some very talented and bright individuals has helped me develop my communication, leadership, and technical skills.
                            I currently work in a web/application development role where I am responsible for the development and maintenance of eCommerce services.
                            For the past 5 years during my Professional Engineering Practice Program I have also been a part of large-scale group projects which
                            have involved application development, embedded systems, and Internet of Things.</p>
                    </div>
                </div>
                <div className="row tech-section justify-content-center pb-3">
                    <div className="col-8">
                        <p>TECHNICAL SKILLS</p>
                        <p>I've worked with various programming languages. For web development I utilise Javascript and frameworks for front-end and back-end such
                            as VueJS and NodeJS and libraries such as jQuery. For desktop applications and high performance code I use C/C++, Java and Python.</p>
                    </div>
                </div>
                <div className="row programming-section justify-content-center pb-5">
                    <div className="col-8 text-center">
                        <p>PROGRAMMING LANGUAGES</p>
                        <p>   •   JAVASCRIPT   •   C   •   C++   •   JAVA   •   PYTHON</p>
                        <p>FRAMEWORKS & ENGINES</p>
                        <p>  •   VUEJS   •   NODEJS   •   JQUERY   •   NIGHTMAREJS   •   UNREAL ENGINE 4</p>
                        <p>SOFTWARE & PROTOCOLS</p>
                        <p>•   LINUX   •   SERVERS   •   FTP   •   SSH   •   SQL   •   WEB APIs   •   FIREBASE CLOUD</p>
                        <p>ALGORITHMS & ARCHITECTURES</p>
                        <p>   •   BINARY SEARCH   •   HEAP/MERGE/QUICK SORT   •   MVC   •   CLIENT-SERVER   •   LAYERED</p>
                        <p>DEVELOPMENT METHODS</p>
                        <p>   •   KANBAN   •   SCRUM   •   RAD</p>
                    </div>
                </div>
                <div className="social-icons text-center pb-5">
                    <p>Get In Touch</p>
                    <a target="_blank" href="https://www.linkedin.com/in/sfaizanh/"><img width="24px" src="https://cdn-icons-png.flaticon.com/512/1384/1384014.png"/></a>
                    <a target="_blank" href="https://github.com/FaizanH"><img width="24px" src="https://cdn-icons-png.flaticon.com/512/733/733609.png"/></a>
                    {/* <a target="_blank" href=""><img width="24px" src="https://drive.google.com/uc?id=1GqnNLDmARpAhGNJ95iIMVcRXf0l5cjDh"/></a> */}
                    <a target="_blank" href="https://www.instagram.com/ghostdc5/"><img width="24px" src="https://cdn-icons-png.flaticon.com/512/1384/1384015.png"/></a>
                    {/* <a target="_blank" href=""><img width="24px" src="https://cdn-icons-png.flaticon.com/512/1384/1384012.png"/></a> */}

                </div>
            </div>
            <div className="container-fluid footer-wrapper fixed-bottom">
                <div className="row p-3">
                    <Footer />
                </div>
            </div>
        </div>
    )
}

export default Home;