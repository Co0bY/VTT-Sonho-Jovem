import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common'
import { Pool } from 'pg'

@Injectable()
export class Database implements OnModuleInit, OnApplicationShutdown {
  readonly pool = new Pool({ host: '127.0.0.1', port: 5432, database: 'vtt', user: 'vtt', password: process.env.POSTGRES_PASSWORD, connectionTimeoutMillis: 3000 })
  constructor() {
    if (!process.env.POSTGRES_PASSWORD) throw new Error('Defina POSTGRES_PASSWORD no .env')
    this.pool.on('error', (error) => console.error('PostgreSQL:', error.message))
  }
  async onModuleInit() {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SELECT pg_advisory_xact_lock(761203)`)
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id uuid PRIMARY KEY, name varchar(80) NOT NULL, email varchar(254) UNIQUE NOT NULL,
          password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at timestamptz NOT NULL
        );
        CREATE TABLE IF NOT EXISTS campaigns (
          id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), name varchar(100) NOT NULL,
          description varchar(1000) NOT NULL DEFAULT '', system varchar(80) NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS campaign_members (
          campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          PRIMARY KEY(campaign_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS invitations (
          token_hash text PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          expires_at timestamptz NOT NULL
        );
      `)
      await client.query(`
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
        CREATE TABLE IF NOT EXISTS password_setup_tokens (
          token_hash text PRIMARY KEY,
          user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at timestamptz NOT NULL
        );
      `)
      await client.query(`
        CREATE TABLE IF NOT EXISTS tabletop_scenes (
          campaign_id uuid PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
          cell_size integer NOT NULL DEFAULT 64 CHECK(cell_size BETWEEN 32 AND 128),
          grid_visible boolean NOT NULL DEFAULT true,
          snap boolean NOT NULL DEFAULT true
        );
        CREATE TABLE IF NOT EXISTS tabletop_tokens (
          id uuid PRIMARY KEY,
          campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name varchar(40) NOT NULL,
          color varchar(7) NOT NULL,
          x double precision NOT NULL CHECK(x BETWEEN 0 AND 3200),
          y double precision NOT NULL CHECK(y BETWEEN 0 AND 2200),
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS tabletop_messages (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          user_id uuid NOT NULL REFERENCES users(id),
          content varchar(2000) NOT NULL,
          roll jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS tabletop_messages_campaign_idx ON tabletop_messages(campaign_id, id DESC);
        CREATE INDEX IF NOT EXISTS tabletop_tokens_campaign_idx ON tabletop_tokens(campaign_id);
      `)
      await client.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token_hash text PRIMARY KEY,
        user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL
      )`)
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tabletop_scenes' AND column_name='id') THEN
            INSERT INTO tabletop_scenes(campaign_id) SELECT id FROM campaigns ON CONFLICT DO NOTHING;
            ALTER TABLE tabletop_scenes ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
            ALTER TABLE tabletop_scenes DROP CONSTRAINT tabletop_scenes_pkey;
            ALTER TABLE tabletop_scenes ADD PRIMARY KEY(id);
            ALTER TABLE tabletop_scenes ADD UNIQUE(id,campaign_id);
            ALTER TABLE tabletop_scenes ADD COLUMN name varchar(100) NOT NULL DEFAULT 'Cenário principal';
            ALTER TABLE tabletop_scenes ADD COLUMN distance_per_cell double precision NOT NULL DEFAULT 1.5 CHECK(distance_per_cell>0 AND distance_per_cell<=1000000000);
            ALTER TABLE tabletop_scenes ADD COLUMN distance_unit varchar(4) NOT NULL DEFAULT 'm' CHECK(distance_unit IN ('mm','cm','m','km','in','ft','yd','mi'));
            ALTER TABLE tabletop_scenes ADD COLUMN background_file text;
            ALTER TABLE tabletop_scenes ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
            CREATE TABLE tabletop_active_scenes (
              campaign_id uuid PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
              scene_id uuid NOT NULL,
              FOREIGN KEY(scene_id,campaign_id) REFERENCES tabletop_scenes(id,campaign_id) ON DELETE CASCADE
            );
            INSERT INTO tabletop_active_scenes SELECT campaign_id,id FROM tabletop_scenes;
            ALTER TABLE tabletop_tokens ADD COLUMN scene_id uuid;
            UPDATE tabletop_tokens t SET scene_id=s.id FROM tabletop_scenes s WHERE s.campaign_id=t.campaign_id;
            ALTER TABLE tabletop_tokens ALTER COLUMN scene_id SET NOT NULL;
            ALTER TABLE tabletop_tokens ADD FOREIGN KEY(scene_id,campaign_id) REFERENCES tabletop_scenes(id,campaign_id) ON DELETE CASCADE;
            CREATE INDEX tabletop_scenes_campaign_idx ON tabletop_scenes(campaign_id);
            CREATE INDEX tabletop_tokens_scene_idx ON tabletop_tokens(scene_id);
          END IF;
        END $$;
      `)
      await client.query(`
        ALTER TABLE tabletop_scenes ADD COLUMN IF NOT EXISTS background_transform jsonb;
        DO $$ BEGIN
          IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tabletop_scenes' AND column_name='grid_type') THEN
            ALTER TABLE tabletop_scenes ADD COLUMN grid_type varchar(6) NOT NULL DEFAULT 'square' CHECK(grid_type IN ('square','hex','none'));
            UPDATE tabletop_scenes SET grid_type='none' WHERE NOT grid_visible;
          END IF;
        END $$;
        ALTER TABLE tabletop_scenes ADD COLUMN IF NOT EXISTS grid_color varchar(7) NOT NULL DEFAULT '#a29aad' CHECK(grid_color ~ '^#[0-9a-fA-F]{6}$');
        ALTER TABLE tabletop_scenes ADD COLUMN IF NOT EXISTS grid_opacity double precision NOT NULL DEFAULT 0.16 CHECK(grid_opacity BETWEEN 0 AND 1);
        ALTER TABLE tabletop_tokens ADD COLUMN IF NOT EXISTS layer varchar(8) NOT NULL DEFAULT 'geral' CHECK(layer IN ('fundo','mestre','geral'));
        CREATE TABLE IF NOT EXISTS tabletop_objects (
          id uuid PRIMARY KEY,
          campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          scene_id uuid NOT NULL,
          name varchar(100) NOT NULL,
          layer varchar(8) NOT NULL CHECK(layer IN ('fundo','mestre','geral')),
          filename text NOT NULL,
          x double precision NOT NULL,
          y double precision NOT NULL,
          width double precision NOT NULL,
          height double precision NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          FOREIGN KEY(scene_id,campaign_id) REFERENCES tabletop_scenes(id,campaign_id) ON DELETE CASCADE
        );
        ALTER TABLE tabletop_objects ADD COLUMN IF NOT EXISTS rotation double precision NOT NULL DEFAULT 0 CHECK(rotation>=0 AND rotation<360);
        DO $$ DECLARE item record; keeper record; next_name text; suffix integer; BEGIN
          IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='tabletop_scene_name_unique') THEN
            FOR item IN SELECT s.* FROM tabletop_scenes s ORDER BY
              EXISTS(SELECT 1 FROM tabletop_active_scenes a WHERE a.scene_id=s.id) DESC,s.created_at,s.id LOOP
              IF EXISTS(SELECT 1 FROM tabletop_active_scenes WHERE scene_id=item.id) THEN CONTINUE; END IF;
              SELECT * INTO keeper FROM tabletop_scenes s WHERE s.campaign_id=item.campaign_id
                AND lower(btrim(s.name))=lower(btrim(item.name)) AND s.id<>item.id
                AND (EXISTS(SELECT 1 FROM tabletop_active_scenes a WHERE a.scene_id=s.id)
                  OR (s.created_at,s.id)<(item.created_at,item.id))
                ORDER BY EXISTS(SELECT 1 FROM tabletop_active_scenes a WHERE a.scene_id=s.id) DESC,s.created_at,s.id LIMIT 1;
              IF FOUND THEN
                IF item.background_file IS NULL AND NOT EXISTS(SELECT 1 FROM tabletop_tokens WHERE scene_id=item.id)
                  AND NOT EXISTS(SELECT 1 FROM tabletop_active_scenes WHERE scene_id=item.id)
                  AND item.cell_size=keeper.cell_size AND item.grid_visible=keeper.grid_visible AND item.snap=keeper.snap
                  AND item.distance_per_cell=keeper.distance_per_cell AND item.distance_unit=keeper.distance_unit THEN
                  DELETE FROM tabletop_scenes WHERE id=item.id;
                ELSE
                  suffix:=2;
                  LOOP
                    next_name:=left(item.name,85)||' ('||suffix||')';
                    EXIT WHEN NOT EXISTS(SELECT 1 FROM tabletop_scenes WHERE campaign_id=item.campaign_id AND lower(btrim(name))=lower(btrim(next_name)));
                    suffix:=suffix+1;
                  END LOOP;
                  UPDATE tabletop_scenes SET name=next_name WHERE id=item.id;
                END IF;
              END IF;
            END LOOP;
          END IF;
        END $$;
        INSERT INTO tabletop_scenes(id,campaign_id) SELECT gen_random_uuid(),c.id FROM campaigns c
          WHERE NOT EXISTS(SELECT 1 FROM tabletop_scenes s WHERE s.campaign_id=c.id);
        INSERT INTO tabletop_active_scenes(campaign_id,scene_id)
          SELECT DISTINCT ON(s.campaign_id) s.campaign_id,s.id FROM tabletop_scenes s
          WHERE NOT EXISTS(SELECT 1 FROM tabletop_active_scenes a WHERE a.campaign_id=s.campaign_id) ORDER BY s.campaign_id,s.created_at,s.id;
        CREATE UNIQUE INDEX IF NOT EXISTS tabletop_scene_name_unique ON tabletop_scenes(campaign_id,lower(btrim(name)));
        CREATE OR REPLACE FUNCTION initialize_campaign_scene() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE scene uuid:=gen_random_uuid(); BEGIN
          INSERT INTO tabletop_scenes(id,campaign_id) VALUES(scene,NEW.id);
          INSERT INTO tabletop_active_scenes(campaign_id,scene_id) VALUES(NEW.id,scene);
          RETURN NEW;
        END $$;
        DROP TRIGGER IF EXISTS initialize_campaign_scene_trigger ON campaigns;
        CREATE TRIGGER initialize_campaign_scene_trigger AFTER INSERT ON campaigns FOR EACH ROW EXECUTE FUNCTION initialize_campaign_scene();
        CREATE OR REPLACE FUNCTION require_one_scene() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          PERFORM id FROM campaigns WHERE id=OLD.campaign_id FOR UPDATE;
          IF FOUND AND (SELECT count(*) FROM tabletop_scenes WHERE campaign_id=OLD.campaign_id)<=1 THEN
            RAISE EXCEPTION 'A mesa precisa ter pelo menos um cenário.' USING ERRCODE='23514';
          END IF;
          RETURN OLD;
        END $$;
        DROP TRIGGER IF EXISTS require_one_scene_trigger ON tabletop_scenes;
        CREATE TRIGGER require_one_scene_trigger BEFORE DELETE ON tabletop_scenes FOR EACH ROW EXECUTE FUNCTION require_one_scene();
      `)
      await client.query(`
        ALTER TABLE tabletop_scenes ADD COLUMN IF NOT EXISTS width integer NOT NULL DEFAULT 3200 CHECK(width BETWEEN 128 AND 16384);
        ALTER TABLE tabletop_scenes ADD COLUMN IF NOT EXISTS height integer NOT NULL DEFAULT 2200 CHECK(height BETWEEN 128 AND 16384);
        ALTER TABLE tabletop_tokens ADD COLUMN IF NOT EXISTS width double precision CHECK(width BETWEEN 8 AND 16384);
        ALTER TABLE tabletop_tokens ADD COLUMN IF NOT EXISTS height double precision CHECK(height BETWEEN 8 AND 16384);
        DO $$ BEGIN
          IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='tabletop_token_dimensions_pair') THEN
            ALTER TABLE tabletop_tokens ADD CONSTRAINT tabletop_token_dimensions_pair CHECK((width IS NULL)=(height IS NULL));
          END IF;
        END $$;
        ALTER TABLE tabletop_tokens DROP CONSTRAINT IF EXISTS tabletop_tokens_x_check;
        ALTER TABLE tabletop_tokens DROP CONSTRAINT IF EXISTS tabletop_tokens_y_check;
        CREATE OR REPLACE FUNCTION check_tabletop_item_bounds() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE scene record; BEGIN
          SELECT width,height INTO scene FROM tabletop_scenes WHERE id=NEW.scene_id FOR SHARE;
          IF TG_TABLE_NAME='tabletop_tokens' THEN
            IF NEW.x<0 OR NEW.y<0 OR NEW.x>scene.width OR NEW.y>scene.height OR (NEW.width IS NOT NULL AND (NEW.x-NEW.width/2<0 OR NEW.y-NEW.height/2<0 OR NEW.x+NEW.width/2>scene.width OR NEW.y+NEW.height/2>scene.height)) THEN
              RAISE EXCEPTION 'Token fora do cenário' USING ERRCODE='23514';
            END IF;
          ELSE
            IF NEW.x<0 OR NEW.y<0 OR NEW.width<8 OR NEW.height<8 OR NEW.x+NEW.width>scene.width OR NEW.y+NEW.height>scene.height THEN
              RAISE EXCEPTION 'Objeto fora do cenário' USING ERRCODE='23514';
            END IF;
          END IF;
          RETURN NEW;
        END $$;
        DROP TRIGGER IF EXISTS tabletop_token_bounds ON tabletop_tokens;
        CREATE TRIGGER tabletop_token_bounds BEFORE INSERT OR UPDATE ON tabletop_tokens FOR EACH ROW EXECUTE FUNCTION check_tabletop_item_bounds();
        DROP TRIGGER IF EXISTS tabletop_object_bounds ON tabletop_objects;
        CREATE TRIGGER tabletop_object_bounds BEFORE INSERT OR UPDATE ON tabletop_objects FOR EACH ROW EXECUTE FUNCTION check_tabletop_item_bounds();
        CREATE OR REPLACE FUNCTION check_scene_content_bounds() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE scene record; rect jsonb; BEGIN
          SELECT * INTO scene FROM tabletop_scenes WHERE id=NEW.id;
          IF NOT FOUND THEN RETURN NULL; END IF;
          rect:=scene.background_transform;
          IF EXISTS(SELECT 1 FROM tabletop_tokens WHERE scene_id=scene.id AND (x<0 OR y<0 OR x>scene.width OR y>scene.height OR (width IS NOT NULL AND (x-width/2<0 OR y-height/2<0 OR x+width/2>scene.width OR y+height/2>scene.height))))
            OR EXISTS(SELECT 1 FROM tabletop_objects WHERE scene_id=scene.id AND (x<0 OR y<0 OR x+width>scene.width OR y+height>scene.height))
            OR (rect IS NOT NULL AND ((rect->>'x')::float<0 OR (rect->>'y')::float<0 OR (rect->>'width')::float<8 OR (rect->>'height')::float<8
              OR (rect->>'x')::float+(rect->>'width')::float>scene.width OR (rect->>'y')::float+(rect->>'height')::float>scene.height)) THEN
            RAISE EXCEPTION 'Conteúdo fora do cenário' USING ERRCODE='23514';
          END IF;
          RETURN NULL;
        END $$;
        DROP TRIGGER IF EXISTS scene_content_bounds ON tabletop_scenes;
        CREATE CONSTRAINT TRIGGER scene_content_bounds AFTER UPDATE ON tabletop_scenes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_scene_content_bounds();
      `)
      await client.query(`
        CREATE TABLE IF NOT EXISTS tabletop_scene_folders (
          id uuid PRIMARY KEY,
          campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          name varchar(100) NOT NULL CHECK(length(btrim(name))>0),
          UNIQUE(id,campaign_id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS tabletop_folder_name_unique ON tabletop_scene_folders(campaign_id,lower(btrim(name)));
        ALTER TABLE tabletop_scenes ADD COLUMN IF NOT EXISTS folder_id uuid;
        DO $$ BEGIN
          IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='tabletop_scene_folder_fk') THEN
            ALTER TABLE tabletop_scenes ADD CONSTRAINT tabletop_scene_folder_fk FOREIGN KEY(folder_id,campaign_id)
              REFERENCES tabletop_scene_folders(id,campaign_id) ON DELETE SET NULL (folder_id);
          END IF;
        END $$;
        CREATE INDEX IF NOT EXISTS tabletop_scenes_folder_idx ON tabletop_scenes(folder_id);
      `)
      await client.query(`
        CREATE TABLE IF NOT EXISTS tabletop_characters (
          id uuid PRIMARY KEY,
          campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name varchar(40) NOT NULL CHECK(length(btrim(name))>0),
          color varchar(7) NOT NULL CHECK(color ~ '^#[0-9a-fA-F]{6}$'),
          appearance_file text,
          token_file text,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(id,campaign_id)
        );
        CREATE INDEX IF NOT EXISTS tabletop_characters_campaign_idx ON tabletop_characters(campaign_id);
        ALTER TABLE tabletop_tokens ADD COLUMN IF NOT EXISTS character_id uuid;
        INSERT INTO tabletop_characters(id,campaign_id,owner_id,name,color,created_at)
          SELECT id,campaign_id,owner_id,name,color,created_at FROM tabletop_tokens WHERE character_id IS NULL
          ON CONFLICT(id) DO NOTHING;
        UPDATE tabletop_tokens SET character_id=id WHERE character_id IS NULL;
        ALTER TABLE tabletop_tokens ALTER COLUMN character_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS tabletop_tokens_character_idx ON tabletop_tokens(character_id);
        DO $$ BEGIN
          IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='tabletop_token_character_fk') THEN
            ALTER TABLE tabletop_tokens ADD CONSTRAINT tabletop_token_character_fk FOREIGN KEY(character_id,campaign_id)
              REFERENCES tabletop_characters(id,campaign_id) ON DELETE CASCADE;
          END IF;
        END $$;
        -- Keep the previous JSON token endpoint compatible without creating anything on scene reads.
        CREATE OR REPLACE FUNCTION initialize_token_character() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.character_id IS NULL THEN
            INSERT INTO tabletop_characters(id,campaign_id,owner_id,name,color) VALUES(NEW.id,NEW.campaign_id,NEW.owner_id,NEW.name,NEW.color);
            NEW.character_id:=NEW.id;
          END IF;
          RETURN NEW;
        END $$;
        DROP TRIGGER IF EXISTS tabletop_token_character ON tabletop_tokens;
        CREATE TRIGGER tabletop_token_character BEFORE INSERT ON tabletop_tokens FOR EACH ROW EXECUTE FUNCTION initialize_token_character();
      `)
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
  async onApplicationShutdown() { await this.pool.end() }
}
