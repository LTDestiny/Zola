--
-- PostgreSQL database dump
--

\restrict e8bcAU3WqdKt6s86Lf1aykaXmYMYqFmAHm1Ziq3TPuwdmeHWBBeuQNR27NJ5YQr

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-04-14 15:48:27

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 16704)
-- Name: flyway_schema_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


ALTER TABLE public.flyway_schema_history OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16812)
-- Name: otp_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    identifier character varying(255) NOT NULL,
    otp_type character varying(30) NOT NULL,
    attempts integer DEFAULT 0,
    sent_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone
);


ALTER TABLE public.otp_logs OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16801)
-- Name: security_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.security_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type character varying(50) NOT NULL,
    ip_address character varying(45),
    device_info text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.security_logs OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16784)
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    refresh_token text NOT NULL,
    device_name character varying(200),
    device_type character varying(50),
    ip_address character varying(45),
    user_agent text,
    is_active boolean DEFAULT true,
    expires_at timestamp without time zone NOT NULL,
    last_used_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16759)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255),
    phone character varying(20),
    identity_type character varying(10) DEFAULT 'EMAIL'::character varying NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(100) NOT NULL,
    avatar_url text,
    gender character varying(10),
    birthdate date,
    is_online boolean DEFAULT false,
    last_seen_at timestamp without time zone,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    email_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,
    two_fa_enabled boolean DEFAULT false,
    two_fa_secret character varying(255),
    tos_accepted_at timestamp without time zone,
    tos_version character varying(20),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 5088 (class 0 OID 16704)
-- Dependencies: 220
-- Data for Name: flyway_schema_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success) FROM stdin;
1	1	init identity schema	SQL	V1__init_identity_schema.sql	-1333507653	postgres	2026-04-14 07:51:01.368434	129	t
2	2	seed identity data	SQL	V2__seed_identity_data.sql	-2003587030	postgres	2026-04-14 07:51:01.596418	225	t
\.


--
-- TOC entry 5092 (class 0 OID 16812)
-- Dependencies: 224
-- Data for Name: otp_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.otp_logs (id, user_id, identifier, otp_type, attempts, sent_at, expires_at, used_at) FROM stdin;
\.


--
-- TOC entry 5091 (class 0 OID 16801)
-- Dependencies: 223
-- Data for Name: security_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.security_logs (id, user_id, event_type, ip_address, device_info, metadata, created_at) FROM stdin;
431e92c8-171e-4da1-81dc-46e522c2ac83	11111111-1111-1111-1111-111111111111	LOGIN	172.18.0.9	Java-http-client/17.0.18	{}	2026-04-14 08:22:22.394387
\.


--
-- TOC entry 5090 (class 0 OID 16784)
-- Dependencies: 222
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_sessions (id, user_id, refresh_token, device_name, device_type, ip_address, user_agent, is_active, expires_at, last_used_at, created_at) FROM stdin;
088b5e0d-b6e6-483d-8e7e-9be09c402f7d	11111111-1111-1111-1111-111111111111	4893cfdf-190a-4adf-b8c9-c851be116852	zola-web	WEB	172.18.0.9	Java-http-client/17.0.18	t	2026-04-21 08:22:22.255925	2026-04-14 08:22:22.255925	2026-04-14 08:22:22.255925
11111111-1111-1111-1111-222222222222	11111111-1111-1111-1111-111111111111	seed-refresh-token-auth-service	Seed Chrome	WEB	127.0.0.1	seed-agent	f	2026-04-21 07:51:01.63571	2026-04-14 07:51:01.63571	2026-04-14 07:51:01.63571
\.


--
-- TOC entry 5089 (class 0 OID 16759)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, phone, identity_type, password_hash, full_name, avatar_url, gender, birthdate, is_online, last_seen_at, is_active, is_deleted, deleted_at, email_verified, phone_verified, two_fa_enabled, two_fa_secret, tos_accepted_at, tos_version, created_at, updated_at) FROM stdin;
11111111-1111-1111-1111-111111111111	seed1@zola.app	0900000001	EMAIL	$2a$10$aq6NKJip.BN.9EwLaNq6tujESq3xS9R65phA4IvlwlZZ0byXncG92	Seed User 1	\N	\N	\N	f	\N	t	f	\N	t	f	f	\N	\N	\N	2026-04-14 07:51:01.63571	2026-04-14 07:51:01.63571
11111111-1111-1111-1111-222222222222	seed2@zola.app	0900000002	EMAIL	$2a$10$h3Rd/xffCbenBv3FwJ.5Kus/X2GVXE4e3I/9bUeeXWBwRwlmu1/jm	Seed User 2	\N	\N	\N	f	\N	t	f	\N	t	f	f	\N	\N	\N	2026-04-14 07:51:01.63571	2026-04-14 07:51:01.63571
11111111-1111-1111-1111-333333333333	seed3@zola.app	0900000003	EMAIL	$2a$10$L/b3sbAn3r3JMr9b8gp4iuqGbzRiCIP7VvZmcLytGOdu4mVVfvzBC	Seed User 3	\N	\N	\N	f	\N	t	f	\N	t	f	f	\N	\N	\N	2026-04-14 07:51:01.63571	2026-04-14 07:51:01.63571
\.


--
-- TOC entry 4925 (class 2606 OID 16719)
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- TOC entry 4940 (class 2606 OID 16823)
-- Name: otp_logs otp_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_logs
    ADD CONSTRAINT otp_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4938 (class 2606 OID 16811)
-- Name: security_logs security_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_logs
    ADD CONSTRAINT security_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4934 (class 2606 OID 16798)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4936 (class 2606 OID 16800)
-- Name: user_sessions user_sessions_refresh_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_refresh_token_key UNIQUE (refresh_token);


--
-- TOC entry 4928 (class 2606 OID 16781)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4930 (class 2606 OID 16783)
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- TOC entry 4932 (class 2606 OID 16779)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4926 (class 1259 OID 16720)
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


-- Completed on 2026-04-14 15:48:27

--
-- PostgreSQL database dump complete
--

\unrestrict e8bcAU3WqdKt6s86Lf1aykaXmYMYqFmAHm1Ziq3TPuwdmeHWBBeuQNR27NJ5YQr

