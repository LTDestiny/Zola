--
-- PostgreSQL database dump
--

\restrict g1yCVdiUpeU1ix4A90fzSWJRerL2b7XjnRzopIVK5wNclkp6vOhe5K7HbdTwjO8

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-04-14 15:50:30

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
-- TOC entry 220 (class 1259 OID 16606)
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
-- TOC entry 221 (class 1259 OID 16661)
-- Name: friendships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    nickname character varying(100),
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.friendships OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16690)
-- Name: group_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) DEFAULT 'MEMBER'::character varying NOT NULL,
    nickname character varying(100),
    joined_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.group_members OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16676)
-- Name: groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    avatar_url text,
    owner_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.groups OWNER TO postgres;

--
-- TOC entry 5073 (class 0 OID 16606)
-- Dependencies: 220
-- Data for Name: flyway_schema_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success) FROM stdin;
1	1	init user schema	SQL	V1__init_user_schema.sql	-1481231391	postgres	2026-04-14 07:51:00.140364	99	t
2	2	seed user data	SQL	V2__seed_user_data.sql	1131734849	postgres	2026-04-14 07:51:00.362702	38	t
\.


--
-- TOC entry 5074 (class 0 OID 16661)
-- Dependencies: 221
-- Data for Name: friendships; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.friendships (id, requester_id, addressee_id, status, nickname, updated_at, created_at) FROM stdin;
21111111-1111-1111-1111-111111111111	11111111-1111-1111-1111-111111111111	11111111-1111-1111-1111-333333333333	ACCEPTED	Seed Friend	2026-04-14 07:51:00.4107	2026-04-14 07:51:00.4107
\.


--
-- TOC entry 5076 (class 0 OID 16690)
-- Dependencies: 223
-- Data for Name: group_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_members (id, group_id, user_id, role, nickname, joined_at) FROM stdin;
\.


--
-- TOC entry 5075 (class 0 OID 16676)
-- Dependencies: 222
-- Data for Name: groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.groups (id, name, avatar_url, owner_id, is_active, created_at, updated_at) FROM stdin;
21111111-1111-1111-1111-222222222222	Seed Group	\N	11111111-1111-1111-1111-111111111111	t	2026-04-14 07:51:00.4107	2026-04-14 07:51:00.4107
\.


--
-- TOC entry 4914 (class 2606 OID 16621)
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- TOC entry 4917 (class 2606 OID 16673)
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- TOC entry 4919 (class 2606 OID 16675)
-- Name: friendships friendships_requester_id_addressee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id);


--
-- TOC entry 4923 (class 2606 OID 16703)
-- Name: group_members group_members_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- TOC entry 4925 (class 2606 OID 16701)
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- TOC entry 4921 (class 2606 OID 16689)
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- TOC entry 4915 (class 1259 OID 16622)
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


-- Completed on 2026-04-14 15:50:30

--
-- PostgreSQL database dump complete
--

\unrestrict g1yCVdiUpeU1ix4A90fzSWJRerL2b7XjnRzopIVK5wNclkp6vOhe5K7HbdTwjO8

