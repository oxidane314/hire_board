# HireBoard

HireBoard is a full-stack job portal that I built to learn backend development with Node.js, Express, and PostgreSQL.

The idea was to create a platform where employers can post jobs and manage applicants, while job seekers can search for jobs, save listings, and submit applications.

This project helped me understand how a real-world web application is structured, from database design and authentication to API development and frontend integration.

## Screenshots

### Home Page

![Home Page](screenshots/home.png)

### Job Listings

![Job Listings](screenshots/jobs.png)

### Sign Up Page

![Sign Up Page](screenshots/signinpage.png)

### Login Page

![Login Page](screenshots/loginpage.png)

### Dashboard

![Dashboard](screenshots/dashboard.png)

## What I Learned

Building this project taught me a lot about backend development and database-driven applications. Some of the main things I learned were:

* Designing a relational database schema in PostgreSQL
* Writing SQL queries involving joins, filtering, and pagination
* Building REST APIs with Express.js
* Implementing authentication using JWTs and cookies
* Creating role-based access control for different types of users
* Preventing SQL injection using parameterized queries
* Managing database connections efficiently using connection pooling
* Structuring a project using the MVC pattern

## Features

### For Job Seekers

* Create an account and log in securely
* Browse and search job listings
* Filter jobs by company, location, salary, and job type
* Save jobs for later
* Apply to jobs with a cover letter
* Track application status

### For Employers

* Create, edit, and delete job postings
* View applicants for each job
* Update application status
* Manage all posted jobs from a dashboard

### Security

* Password hashing using bcrypt
* JWT-based authentication
* Input validation with express-validator
* Parameterized SQL queries
* XSS protection on user-generated content

## Why I Built This

I wanted a project that would help me practice backend development beyond simple CRUD applications.

Instead of building isolated APIs, I wanted to work on a complete application that included:

* Authentication
* Authorization
* Database design
* Search and filtering
* Frontend integration
* Deployment preparation

The result was HireBoard, a job portal that demonstrates many of the concepts commonly used in modern web applications.
