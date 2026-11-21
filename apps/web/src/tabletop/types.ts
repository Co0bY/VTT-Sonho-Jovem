import type { TokenBar, TokenSettings } from './token-settings'
import type { Reduction } from './sheet-macros'
import type { SavedSheet } from './character-sheet'
export type Layer = 'fundo' | 'mestre' | 'geral'
export type Rect = {x:number;y:number;width:number;height:number;rotation?:number}
export type SceneObject = Rect & {id:string;name:string;layer:Layer;image_url:string}
export type Character = {folder_id:string|null;visible_to?:string[];sheet:SavedSheet;sheet_background_url:string|null;description_format:'plain'|'html';notes_format:'plain'|'html';description:string;notes:string;id:string;owner_id:string;name:string;color:string;appearance_url:string|null;token_url:string|null}
export type TokenProperties = { defense: number | null; observation: number | null; settings?: Partial<TokenSettings> }
export type Token = TokenProperties & { display_bars?: Pick<TokenBar, 'value' | 'max'>[];rotation:number;width:number|null;height:number|null;character_id:string;token_url:string|null; layer: Layer; id: string; owner_id: string; name: string; color: string; x: number; y: number }
export type CharacterFolder = {id:string;name:string}
export type SceneFolder = {id:string;name:string}
export type Scene = { folder_id:string|null; id: string; name: string; distance_per_cell: number; distance_unit: string; background_url: string | null; background_transform: Rect | null; cell_size: number; grid_type: 'square' | 'hex' | 'none'; grid_visible: boolean; grid_color: string; grid_opacity: number; snap: boolean; width: number; height: number }
export type Member = { id: string; name: string; role: string }
export type Message = { id: string; content: string; author: string; user_id: string; created_at: string; roll: null | { expression: string; rolls: number[]; modifier: number; total: number } | { expression:string; groups:{expression:string;rolls:number[];reduction:Reduction|'sucesso'|null;total:number|null;success?:{min:number;max:number;hits:number;misses:number}}[];combine:Reduction|null;total:number|null } }
export type ChatPage = { messages: Message[]; hasOlderMessages: boolean }
export type Tabletop = { campaign: { id: string; name: string; system: string; description: string }; user: { id: string; name: string }; role: string; characters:Character[]; character_folders:CharacterFolder[]; folders:SceneFolder[]; scene: Scene; scenes: Scene[]; tokens: Token[]; objects: SceneObject[]; messages: Message[]; hasOlderMessages?: boolean; members: Member[] }
export type Tool = 'select' | 'pan' | 'measure'

export type CharacterCard = Pick<Character,'id'|'name'|'color'|'appearance_url'|'token_url'> & {description:string}
