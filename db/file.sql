--
-- PostgreSQL database dump
--

\restrict shbPbLCiRgcBoP1SLqcHVrWUihEMjlTmUrLLrd5l6xPttYJNWzn3dbXiut2pCsc

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-04-14 15:49:21

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

--
-- TOC entry 2 (class 3079 OID 16556)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5059 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 16594)
-- Name: file_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.file_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    uploader_id uuid,
    file_key text NOT NULL,
    action character varying(30) NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.file_audit_logs OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16539)
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
-- TOC entry 5053 (class 0 OID 16594)
-- Dependencies: 221
-- Data for Name: file_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.file_audit_logs (id, uploader_id, file_key, action, metadata, created_at) FROM stdin;
41111111-1111-1111-1111-111111111111	11111111-1111-1111-1111-111111111111	seed/hello.txt	UPLOAD	{"source": "seed"}	2026-04-14 07:50:59.852087
\.


--
-- TOC entry 5052 (class 0 OID 16539)
-- Dependencies: 220
-- Data for Name: flyway_schema_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success) FROM stdin;
1	1	init file schema	SQL	V1__init_file_schema.sql	822368728	postgres	2026-04-14 07:50:59.414719	216	t
2	2	seed file data	SQL	V2__seed_file_data.sql	-768505521	postgres	2026-04-14 07:50:59.816948	34	t
\.


--
-- TOC entry 4904 (class 2606 OID 16605)
-- Name: file_audit_logs file_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_audit_logs
    ADD CONSTRAINT file_audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4901 (class 2606 OID 16554)
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- TOC entry 4902 (class 1259 OID 16555)
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


-- Completed on 2026-04-14 15:49:22

--
-- PostgreSQL database dump complete
--

\unrestrict shbPbLCiRgcBoP1SLqcHVrWUihEMjlTmUrLLrd5l6xPttYJNWzn3dbXiut2pCsc

