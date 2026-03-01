# Username Denylist Source of Truth

## Purpose
This file is the canonical denylist source used to seed backend username validation.
Backend validation on submit is mandatory; frontend checks are UX-only prevalidation.

## Content Warning
This file intentionally contains offensive, hateful, sexual, and scam-related terms for abuse prevention and impersonation defense.

## Source Metadata
1. Baseline package: `@2toad/profanity`
2. Baseline version: `3.2.0`
3. Baseline upstream repository: `https://github.com/2Toad/Profanity`
4. Baseline source tarball: `https://registry.npmjs.org/@2toad/profanity/-/profanity-3.2.0.tgz`
5. Generated at: `2026-03-01T06:53:02.820Z`
6. Custom overlays: owner/admin reserved handles + security/scam impersonation terms + additional hate/abuse terms.

## Baseline Locale Counts
- `ar`: 323
- `de`: 368
- `en`: 449
- `es`: 363
- `fr`: 372
- `hi`: 337
- `it`: 168
- `ja`: 317
- `ko`: 114
- `pt`: 322
- `ru`: 314
- `zh`: 292

## Overlay Counts
- Reserved owner/admin terms: 97
- Security/scam terms: 53
- Additional hate/abuse terms: 49
- Total custom overlays (unique): 199

## Reserved Handle Categories (Owner/Admin Assignable)
These are enforced in backend via `username_reserved_handles` and include category metadata.
- `system_owner`: admin/system/owner namespace, platform-critical names.
- `support`: support/help/helpdesk/customer-support impersonation names.
- `security`: verification/official/trust/safety/security-team impersonation names.
- `finance`: billing/payments/refund and payment-support impersonation names.
- `auth`: login/signin/signup/register/auth namespace.
- `platform`: route/platform pages (`api`, `www`, `about`, `profile`, `settings`, etc.).
- `brand`: product/brand namespaces (for example `travelflow`, `travelplanner`).

## Rule Notes
- Username format enforcement is `^[A-Za-z0-9_-]{3,20}$` for display and lowercase canonical routing/uniqueness.
- Handles without any letters or digits are rejected (for example `___` and `---`).
- DB submit-time validation is mandatory; frontend validation is pre-submit UX only.

## Effective Enforcement Scope (Current)
- Allowed username charset is ASCII Latin letters + digits + `_` + `-` only.
- Minimum length is `3`, maximum length is `20`.
- Terms that do not match `^[a-z0-9_-]{3,20}$` (after lowercase/trim normalization) are not effective under current username policy.
- Backend denylist/reserved storage is category-separated in DB tables:
  - `username_reserved_handles` (reserved owner/admin/system/support/security namespaces).
  - `username_blocked_terms` (abuse/hate/scam terms).
- SQL migration enforces format constraints on both tables and removes invalid legacy rows before constraints are applied.

## Seeded DB Category Counts (Current SQL)
- Reserved handles total: `71`
  - `platform`: `19`
  - `security`: `16`
  - `system_owner`: `11`
  - `support`: `11`
  - `auth`: `7`
  - `brand`: `4`
  - `finance`: `3`
- Blocked terms total: `33`
  - `scam`: `18`
  - `hate_speech`: `15`

## Effective Combined Username Denylist
Total unique terms: **2743**

```text
- não
- o quê
- oui
- sim
¡dedo
¡maldita sea
¡mierda
·
· fcuk
(ب)
(جاك أوف)
(جاك)
(单位:美元)
♪
♪♪
$
$$
$$$$
₢ 킹
00бс
00се
1488
14words
17ч
1кк
1시간
2fa
3 points
3ч
4 h
4nny
4r5e
4r5e (4r5e) (韩语)
4r5e를
4r5eの
5
5 heures
55
5h1t
5hit
5хит
5열
5ヒット
5发
5小时1小时
a $s
a dólares
a tremer
a_s_s
a)
a$
a$$
a$s
a55
a55's 수
a55个
about
account
accounts
admin
admin-help
admin-support
administrator
admins
agent
airdrop
allupato
amendoim
americanexpress
amex
amigos
ammucchiata
anal
anale
ânes
anus
api
ar5e
ar5eの
arnaque
arrapato
arrs
arrse
arrumos
arrusa
arruso
arsch
arschficker
arschganz
arschloch
arschlöcher
arse
arses
as$
ass
ass fucker
ass-fucker
assatanato
asses
assfucker
assfukka
asshole
assholes
asswhole
attaque
aus
ausleger
auth
authenticator
avec les doigts
aw
b
b!tch
b!パッチ
b.tch
b+ch
b00
b00b
b00bs
b00bsの
b1
b17ch
b17ch (英语)
b17chの
b1tch
b1tchの
b1吨级
bagascia
bagassa
bagnarsi
baise-moi
baisée
baldracca
ballbag
balle
bälle
balls
ballsack
bandes
bank
banking
bar
bastard
bastardo
bâtard
battere
battona
beastial
beastialität
beastiality
belino
bellend
bestia
bestial
bestialidad
bestialidade
bestialität
bestialité
bestiality
bête
bêteté
bi-ch
bi+ch
bi+chの
biatch
biga
bigotes
billing
binance
bitch
bitchboy
bitcher
bitchers
bitches
bitchin
bitching
bitcoin
bite
bites sucées
blasen
blog
bloody
blow job
blowjob
blowjobs
bo
boa noite
boa sorte
bocchinara
bocchino
bofilo
boiata
boiolas
bolas
bollock
bollok
bolo
bolsa de bolas
boner
boob
boobs
booobs
boooobs
booooobs
boooooobs
booooooobs
bordas
bordello
botão
bouchées de doigts
bouchons
boucliers
boules
bouton
boutonjokey
boutonné
boutons
brand
branlé
branleur
breasts
brida
bride
brilhante
brilho
brinca
broche
broches
brüste
bucaiolo
buceta
budiùlo
bugger
buhn
bullshit
bum
bunda
bundas
busone
butt
butthole
buttmuch
buttplug
butts
c'est ça
c0ck
c0ck (英语)
c0cksucker
c0cksuckerの
c0m
cabeça de cabeça
cabeça de pau
cabra
cabrão
cabras
cabrões
cabrón
caca
cacca
caciocappella
cadavere
cadelas
cagare
cagata
cagna
caído
caliente
cãozinho
caprins
cara de pau
caralho
caralhos
careers
carpet muncher
carpinteiro
casci
cawk
cazzata
cazzimma
cazzo
cazzone
cesso
ch
chatte
chattes
checca
chiappa
chiavare
chiavata
chienne
child-porn
childporn
childrapist
chine
chink
chulos
chupa penes
chupa pollas
chupavergas
cialis
cibercriminoso
ciberdelincuente
cibernético
ciberpolvo
ciospo
cipa
ciucciami il cazzo
cl1t
cl1t 键
claire
cláudia
clérigos
cliquetis
clit
clito
clitoris
clítoris
clits
clocher
cnut
cock
cock-sucker
cockface
cockhead
cockmunch
cockmuncher
cocks
cocksuck
cocksucked
cocksucker
cocksucking
cocksucks
cocksuka
cocksukka
cocó
cofounder
coglione
coglioni
coinbase
cok
cokmuncher
coksucka
colheitadeira
colibrí
com licença
community-manager
communitymanager
como $
company
compliance
cona
conas
connard
consoladores
contact
cookies
coon
coq
coq-muncher
coqs
coqsucks
cornuto
corporate
corrida
cortina
cox
cozza
cp
crap
create
crétin
crétins
cricks
croûte
crypto
cul
culattina
culattone
culo
culo completo
culo de mierda
culos
culotte
culs
cum
cummer
cumming
cúmplices
cums
cumshot
cuñada
cuñas
cunilingus
cunillingus
cunnilingus
cunt
cuntlick
cuntlicker
cuntlicking
cunts
cúpula
customer-care
customer-support
customersupport
cyalis
cyalis의
cyberdépannage
cyberficken
cyberficker
cyberfickt
cyberfuc
cyberfuck
cyberfucked
cyberfucker
cyberfuckers
cyberfucking
d'ânes
d1ck
d1ck (英语)
d1ckの
damn
de verão
décollage
dedo
dedo de mierda
dedos
dedos de mierda
des conneries
des gangs
des kums
des merdes
détecteur
dev
developer
dick
dickhead
dickheadの
dieu maudit
dildo
dildos
dink
dinks
dirsa
dirsança
ditalino
dl
dlck
docs
documentation
dog-fucker
doggin
dogging
donkeyribber
doosh
dord
doublemoney
doubling
doux
duche
duché
duquesa
dyke
eier
ejaculação
ejaculação interna
ejaculações
ejaculada
ejaculando
ejaculate
éjaculate
ejaculated
ejaculated(エジャキュレーション)
ejaculates
ejaculating
ejaculating(エジャカルト)
ejaculating(エジャキュレーション)
ejaculatings
ejaculation
éjaculation
ejaculations
éjaculations
ejakulat
ejakulate
ejakulateの
ejakulation
ejakuliert
employee
en colère
en dollars
enculé
enculé de chien
enculé de cul
enculés
enfoiré
enfoirés
engourdissements
enojada
entendido
escroto
escrow
esel
eselibber
espèce d'enfoiré
et toi
ethereum
ethniccleansing
eu sei
évier
éviers
excitado
excité
eyaculación
eyaculaciones
eyaculada
eyaculado
eyaculados
eyaculando
eyakulate
f u c k
f u c k e r
f_u_c_k
f4b
f4nny
f4ny (英语)
fag
fagão
fagging
faggit
faggitt
faggot
faggs
fagot
fagots
fags
fanny
fannyflaps
fannyfucker
fantoche
fany
fanyy
farcis
fatass
fava
fcuk
fcuk (英语)
fcuker
fcuking
fcuting
feck
fecker
fehler
felching
felgen
fellate
fellatio
femminuccia
fesses
fettass
feu
feuillage
fica
fick
fick mich
ficks
figa
figlio di buona donna
figlio di puttana
figone
filho da mãe
filho da puta
filhos da puta
fils de pute
fingerfick
fingerficken
fingerficker
fingerfickt
fingerfuck
fingerfucked
fingerfucker
fingerfuckers
fingerfucking
fingerfucks
finocchio
fistficken
fistfickt
fistfuck
fistfucked
fistfucker
fistfuckers
fistfucking
fistfuckings
fistfucks
flange
flansch
flat
foda-se
fodas
fode-se
fodendo
fodida
fodido
foggitt
fokkin
follada
fook
fooker
fottere
fottersi
fotze
founder
fox0r
fracicone
frappe de poing
frappes de poing
fraud-team
free-money
fregna
frocio
froscio
fuck
fucka
fucked
fucker
fuckers
fuckhead
fuckheads
fuckin
fucking
fucking des doigts
fuckings
fuckingshitmotherfucker
fuckme
fucks
fuckwhit
fuckwhitさん
fuckwit
fuckwitの
fudge packer
fudgepacker
fuk
fuker
fukker
fukkin
fuks
fukwhit
fukwit
fukwitの
furx0r (英语)
fusibles
fusils
fux
fux0r
galão
gallos
gangbang
gangbanged
gangbangs
gasjews
gay
gaylord
gaysex
gaysexe
gefickt
geil
geknallt
genocide
geschlecht
giveaway
gland
glocke
goatse
god-dam
god-damned
goddamn
goddamned
gode
godes
goldone
gook
gorda
gott-dam
gras
grasa
gros cul
gros plan
guardone
hahnmacher
hardcoresex
hardcoresexe
headass
heilhitler
help-center
help-center-live
helpcentre
helpdesk
helpsupport
hijo de puta
hijos de puta
hintern
hitler
hoar
hoare
hoden
hoer
hoes
homo
hor
hore
horniest
horny
hotsex
hueso
huhn
hündchen
hunde
hundeficker
hure
i3
i3i+ch
idiot
idiota
idiotas
imbécil
imbecille
impersonation
impersonator
imposição
imprint
in %
incazzarsi
incest
incoglionirsi
incômodo
infesté
ingoio
investment
investor
invoice
jack-off
jackoff
jante
jap
jerk-off
jism
jism 语句
jisma
jismo
jiz
jizm
jizz
jobs
jocky
jogos de vestir
julgo
júnior
kacke
kawk
kike
killall
kkk
klan
klitoris
knaufende
kno
knobead
knobed
knobend
knobhead
knobjocky
knobjokey
knochen
knopfkopf
knospead
knospen
knowjokey
knüppel
kock
kokmuncher
kokos
koksucka
kondum
kondums
ku
kugelbeutel
kum
kümmel
kummer
kumming
kums
kunilingus
l3i+ch
l3i+ch 键
l3i+chの
l3itch
l3itchの
labia
laboratório
lancer
le jisme
le kumming
le muthafecker
le phuking
leccaculo
lecchino
lèche-cul
legal
les
les briques
les cyber-fuckers
les fannyflaps
les nichons
les phuks
les pisseurs
les plus excités
les salopes
levrette
lofare
loffa
loffare
login
logout
los ciberdelincuentes
lujuria
lust
lustig
lusting
lustrando
lustre
luxure
lynching
m0f
m0f0
m0f0 时
m0fo
m0fo 数据
m0foの
m45 位点
m45terbat
m45terbate
m45terbateの
m45terterate
m5terb8
ma5terb8
ma5terb8 键
ma5terbat
ma5terbate
ma5terbateの
madre mierda
mail
mailer
mais
maître
maître-bat*
maître-bateau
maîtreb8
maîtrise3
maldição
maldición
maldita sea
maldito
mamada
mamadas
mamas
mannaggia
maquereau
maricas
maricón
más caliente
mas..
masochist
masochiste
masoquista
master-bate
masterb8
masterbação
masterbat
masterbat*
masterbat3
masterbate
masterbation
masterbationen
masterbations
mastercard
mastplug
masturbación
masturbar-se
masturbate
masturbe
masturbieren
meadas
meando
meandos
media
mégots
merda
merdas
merdata
merde
merdeux
merdique
merdoso
mestre-bate
metamask
metzger
mfa
mierda
mierda mierda mierda madre mierda mierda mierda
mierdas
mignotta
mijando
minchia
minchione
mist
miúda
miúdo
mo
mo-fo
mod
mod-support
moderator
mods
mof0
mofo
mona
money-back
mongoloid
monta
montare
mothafuck
mothafucka
mothafuckas
mothafuckaz
mothafucked
mothafucker
mothafuckers
mothafuckin
mothafucking
mothafuckings
mothafucks
motherfuck
motherfucked
motherfucker
motherfuckers
motherfuckin
motherfucking
motherfuckings
motherfuckka
motherfucks
mottafucked
muff
munche de coq
muschi
muschis
mussa
muthafecer
muthafecker
muthafuckker
mutherfucker
n1gga
n1ggaの
n1gger
n1gger (英语)
n1ガー
não
não sei
não te metas
nave scuola
nazi
nazism
negga
nègre
nègres
negro
negros
neo-nazi
neonazi
nerchia
nft
ni4h
nigg3r
nigg4h
nigga
niggah
niggas
niggaz
nigger
niggers
niggué
no
no-reply
nob
nob jokey
nobhead
nobjocky
nobjokey
nom de dieu
noreply
nozes
nueces
numbnuts
nussack
nüsse
nut
nutsack
o quê
o que é
o que é isso
o que é que se passa
o que fazer
o que foi
o que se passa
oauth
official
official-support
operations
ops
orgasim
orgasime
orgasims
orgasm
orgasme
orgasmen
orgasmes
orgasmo
orgasmos
orgasms
orgasmus
orina
orinar
os cibercriminosos
os pretos
osseux
osso
otp
ouvrage
ouvrés
owner
p
p0
p0rn
p0rn 语录
p0rnの
padulo
paedophile
paki
palle
palloso
pão
parafusos
partner
partners
password-reset
patacca
pâte
pateta
patonza
paus
pausucked
pausucking
pausuka
pauzinho
pawn
payments
paypal
peaux
pecker
pecorina
pédé
pédés
pedo
pedophile
peitos
pene
penes negros grandes
penis
pénis
pênis
penisfucker
pênisfucker
peón
perra
perras
perro
perro mierda
pesce
pfoten
phantasievoll
phonesex
phuck
phuk
phuked
phuking
phukked
phukking
phuks
phuq
phuras
pias
pic
picio
pigfucker
pimba
pimpis
pimpos
pincare
pinnolone
pipe
pipes
pipì
pippa
pippone
pique
pirla
pisciare
piscio
pisello
pispa
piss
pisse
pissed
pisseff
pissen
pisser
pissers
pisses
pissflaps
pissin
pissing
pissoff
pistolotto
plug anal
poitrines
polla
polla grande
polla-sucker
pollas
pollasucked
pomiciare
pomme
pompa
pompino
poop
por favor
porca
porca madonna
porca miseria
porca puttana
porco
porco due
porco zio
porn
porno
pornô
pornografia
pornografía
pornografie
pornographie mettant en scène des enfants
pornography
pornos
porra
postmaster
potta
pour
pousse
pousses de pisse
press
preto
pretos
prick
pricks
privacy
profile
profiles
profit
pron
pube
puppami
purée
pusse
pussi
pussies
pussy
pussys
pussys 소개
puta
puta mierda
putain
putains
putas
pute
puttana
puxa
puxas
quaglia
que merda
que se lixe
raghead
raios
rape
rapist
recchione
recover-account
recovery
recovery-agent
recto
rectum
refund
regina
register
rektum
reset-account
retard
retardado
retirada
returns
rimjaw
rimming
rincoglionire
risk-team
rizzarsi
rompiballe
rompipalle
root
ruffiano
s hit
s_h_i_t
s.o.b.
s'il vous plaît
sabots
sac à bille
sac à billes
sac à noix
sacana
saco de bola
sádico
sadique
sadist
sadista
salope
salopes
samen
sanglant
sangrento
sankk
sbattere
sbattersi
sborra
sborrata
sborrone
sbrodolata
scheiße
scheißkerl
scheißkerle
scheißkopf
scherben
schlampe
schlampen
schlitten
schlong
schrauben
schwachsinn
schwanz
schwänze
schwanzkopf
schwanzlutscher
schwanzsauger
schweinefucker
schwuchtel
schwuchteln
sciages
scopare
scopata
scorreggiare
screwing
scroat
scrote
scrotte
scrotum
secure
security
security-alert
security-team
securityteam
sega
seigneur
sein
seins
semen
sémen
senos
service
servicedesk
settings
sex
sexe
sexe chaud
sexo
sexo quente
sh
sh!+
sh!t
sh1t
sh1tの
shag
shagger
shaggin
shagging
shank
shema
shemale
shi+
shi+ 键
shit
shitdick
shite
shited
shitey
shitfuck
shitful
shitfull
shithead
shiting
shitings
shits
shitted
shitter
shitters
shitting
shittings
shitty
siegheil
signalisation
signin
signup
skank
skroat
skrote
skrotum
slinguare
slinguata
slut
sluts
smandrappata
smegma
smut
snatch
soccia
socmel
son-of-a-bitch
sorca
souris
spac
spagnola
sperme
spermes
spic
splitter
spompinare
spunk
staff
staff-support
status
statuspage
sticchio
stiche
stripe
stronza
stronzata
stronzo
succhiami
succhione
suceur de bite
suceur de pénis
sucre de bite
sunk
support
support-agent
support-live
sur gage
sveltina
sverginare
sysadmin
system
t
t1t
t1t1e5
t1tiétés
t1tt1e5
t1tt1e5 键
t1tt1e5の特長
t1tties
t1티
t1タイ
tablier
tarzanello
taux de chute
team
teets
teez
telefonesex
teléfonosex
telefonsex
téléphonex
temblando
terms
terrone
testa di cazzo
testical
testicle
testicule
testículo
testique
tetas
tête de bite
tête de bouton
tête de coq
tête de cul
tête de noeud
tétons
tette
thorax
tirare
tit
titã
titãs
titfuck
titre
titre5
tits
titt
titten
tittie
tittie5
tittiefucker
tittiefucker의
titties
tittyfuck
tittyfuck의
tittywank
tittywank, 영국
titular
titwank
titwank의
titwankの
token
topa
tornillo
toser
tosser
tranny
transen
transexual
transexuelle
travel_flow
travel-flow
travelflow
travelflowapp
travelplanner
trip
tripplanner
trips
troia
trombare
trou du cul
trust
trust-safety
trustsafety
tudo bem
turd
turva
tuyau
tw4t
tw4tの
tw4吨级
twat
twathead
twatty
twunt
twunter
u
un gangbang
ưμ㼯a
v1 颜色
v14g
v14gra
v14gra (英语)
v14graの
v14гра
v14그라
v1gra
v1graの
v1гра
v1그라
vacca
vaffanculo
vagin
vagina
vaginas
vamos
vangare
verdammt
verfickt
verification
verification-team
verified
verified-team
verzögert
via satélite
viagra
via草
visa
visage de coq
vissage
vulva
vulve
w00se
wa
wahnsinn
walies
wallet
wang
wank
wanker
wanky
watt
wa头
webmaster
wetback
white-power
white-supremacy
whitepower
whitesupremacy
whoar
whore
wichser
willies
willy
www
ya
ziegen
zinne
zio cantante
zoccola
zoophile
zoophilia
анальный
анус
аррс
асфукка
б/ч
бандаж
бандитизм
бандиты
бегство
бежокей
бездельник
би+ч
блин
блядь
болван
болваны
боллок
бродяга
буйвол
буллок
буцета
ван
вес
виагра
влагалище
волей
вор
ворчать
вульва
вялый
гайка
гей-лорд
гейсекс
герцог
гной
говнюк
говнюки
голова
гомо
горло
горшок
гребаный
гребаный палец
грудь
грязь
дамба
двустворчатый
дерьмо
дерьмовый
джиза
джизм
дирша
долбаный
дрожать
дрочить
душ
ебаный
ебать
ерунда
женщина
задница
задницы
засранец
затвор
звериность
звериный
кабак
как $
какашка
кекс
кексука
кибер-ебать
кибер-трах
киберпреступник
киберпреступники
киберпроклятый
киберфук
киска
клит
клитор
клиты
кнопка
кнут
козел
кокс
колокольчик
колоть
кондум
кондумы
костлявый
кровавый
кум
куммер
кумминг
кумс
кумунчер
кумшот
кун
кунилингус
куниллингус
куннилингус
лабиринт
лаять
лицо члена
лоб
ма5тербат
мазохист
мастер-бит
мастер8
мастербат
мастербации
мастербирование
мастерить
мастурбировать
мафия
мешок
мешок с мячом
минет
молоток
молохвост
мотафак
мотафакер
мотафакеры
мотафакин
мотафук
мотыга
мотылек
мофо
моча
мошонка
мудак
мутхафекер
мухи
наклон
нацистский
негр
неряшливый
нигга
ниггаз
ниггер
ниггеры
ноб
нобджоки
обезболивающие
облажаться
обман
обнимать
обожженный
обрамление
оргазм
оселовоз
откидывание
отрыжка
отсрочка
отсталый
отстой
пак
пальчики
паук
педик
педики
педикюр
пенис
пенисовец
пессина
петух
петухи
пешка
пизда
пиздец
писать
полный
помойка
порно
порнография
порох
поршни
похищать
похоть
придурки
придурок
приправа
проклятый
прямая кишка
пусси
пыхтение
пьянство
пьяный
разозленный
римжа
рог
роговой
ручка
рывок
с.о.б.
садист
самый роговой
сволочь
секс
сиська
сиськи
сиськи5
скотство
смегма
смута
собака
собачий
сорняк
сосать член
сосульки
сперма
сраный
сраный пальцем
стерва
стервы
стучать
сука
сукин сын
сутенер
т1тис
тез
телефоны
тестовый
титванк
толстый
топор
тоссер
трахаться
трость
тупица
ублюдки
ублюдок
уколы
усатый
фагот
фаготы
фак
фаллоимитатор
фанатичный
фаннифлапс
фелляция
фланцеобразный
фото
фук
фуквист
фукер
фуккин
хардкорекс
хриплый
хуй
хулиган
циалис
черт возьми
чертов ублюдок
член
членоголовый
членосос
членсука
чокнутый
шаггин
шары
ше! +
ши+
шипа
шипение
шлонг
шлюха
шлюхи
шт
щекотать
щекотливый
эякулированный
эякулировать
эякулирует
эякулирующий
эякуляция
яблочный
яичко
أحمق
أعمال تفجيرية
أيها الحقير
أيها اللعين
أيها الوغد
إعادة التشكيل
ابن العاهرة
اختباري
الأحمق
الأشقر
الأفضلية
الأورام
الأوغاد
الإغراء
الإنترنت(ج)
الإيجاز
الاستمناء
البوق
البول
البوووب
التحفة
الثدي
الثعلب
الجبناء
الجرس
الجزيئات
الجنس
الحصان
الحضانات
الحمقى
الحمير
الخوخ
الخيال
الدهون
الرأس
الراهبات
الرهن
الزنوج
الشاذ
الشواذ
الطهي
العاهرات
العبث
العصابات
العظام
الفضاء الإلكتروني
الفوكة
القذف
القرف
القضيب
القواد
الكرات
الكرة
الكلاب
الكلب
الكلب اللعين
الكلبات
الكلبة
الكم
الكوندوم
اللعنة
اللعين
المؤخرات
الماجستير
الماجستير(ب)
الماعز
المتخلفون
المختبرات
الملاعين
الملاعين السيبرانيين
المناقشة الرئيسية 3
المناقشة العامة*
المهرجان
المواد الإباحية
النشوة
النقر
الهرجات
الهواتف الجنسية
الوحشية
الوغد
الويلات
بول
بيكر
تبول
تسلل عبر الإنترنت
توان
جبان
حانة
حبس
حبوب منع الحمل
حثالة
حشرة
حمأة
حمقى
خصية
درجة الماجستير
دولار
دينك
رشاش
رهبان
زائفة
زنجي
سادي
سافل
سحقًا
سخيف
سقط
سكران غاضب
سيدي
ش
شجر
شهوة
صدر
صراخ
صلبة
صمامات
عاهرات
عاهرة
عصيان
عمل فاسد
فاسد
فاني
فوك
فوكر
فوكوهي
فوكويت
قبضة لعينة
قذف
قضيب
كدولارات
كرات
كوك
كوكاكوتا
كوكر
كوكس
لعين
مؤخرة
مارس الجنس مع
متعهد
مثارة
مثلي الجنس
مثير
مجنون
مسوخ
مضاجعة
مقهى
ملاعين
موثا
نابوكي
نازي
نقية
هراء
وانغ
وجهك
وغد
ويلي
يا إلهي
अखरोट
अंडकोष
अश्लील
आर्सेना
इच्छा
उंगलियों
उंगली करना
एनस
कट्टर
कट्टरसेक्स
कमबख्त
कमशॉट
कावा
कुत्ते
कुत्ते-fucker
कुम्भ
केकड़ा
कॉक
कॉकफेस
कोक
कोंडोम
कोन
कोन्डम
क्लिट
क्लिटोरिस
खूनी
गड़बड़
गधा
गिरती
गिरना
गिरोह बैंग
गुत्थी
गुदगुदी
गुदामैथुन
गुनगुना
गुलगुला
गेंद
गेंदों
घंटी
घुंडी
घूंघट
चक
चमकना
चाचा
चिंक
चुभोना
चूंचियां
चॉकर
छीनना
छूत
जानवर
जिज़
जिज़्म
जैक ऑफ
जैकपॉट
जैप
झरना
टट्टू
टिट
टिट्स
टी
टी1टी
टीज़
ट्रिक
ट्वंट
ट्वंटर
डंक
डच
डाइक
डिक
डिल्डो
डोष
तैसा
देवता
देवी
नट्सैक
नागा
नाज़ी
निगा
निगाह
नोब
नोबहेड
पतला
पिम्पिस
पुसी
पेकर
पेंच
पेनिस
पेशाब
पेशाब करना
पोप
पोर्नोग्राफी
प्रोन
फक
फुक
फुकेत
फुहार
फूहड़
फ़ैग
फैनी
फैनीफ्लैप
फोनसेक्स
बकरी
बकवास
बगीचा
बट
बटमच
बटहोल
बस्टर्ड
बिच
बिटच
बिटचर
बिटचिन
बिटिंग
बिट्च
बियोला
बिल्ली
बेटा
बॉलबैग
बोललोक
बोल्क
भाड़ में जाओ
मंदिर
मरोड़ते
माँ
माताओं
माफ
मास्टर-बेट
मास्टरब8
मास्टरबेट
मास्टरबैट*
मास्टरबैट3
मुख-मैथुन
मुट्ठीकरना
मुर्गा
मुर्गा चूसने
मुर्गा चूसने वाला
मैसोचिस्ट
मोहन
योनि
राशि
रिमजॉ
लैबिया
वसा
वांग
वियाग्रा
वीर्य
वृषण
शराब
शस्त्र
शि +
शिटर
शिटिंग
शिट्टी
शिथिल
श्रेष्ठ
श्रेष्ठता
संभोग सुख
समलैंगिक
समानता
सह
साइटमैप
साइबर बकवास
साइबरफ़ुक
सिर
सींग का
सेक्स
सेक्सी
स्तन
स्पेक
हड्डी
हस्तमैथुन
हिंदी
हिन्दी
हो
होम
होर
가슴5
가장 핫한
개 게이
개진
갱뱅
게이sex
게이주
견과류
관련 기사
관련 제품
노브
노브조키
뉴스 레터
뚱 베어
뚱뚱뚱
마스터 배트*
마스터b8
마스터배트3
마스터베이트
맨 위로
메뉴 닫기
모thafuck
모thafucka
모thafuckas
모thafuckaz
모thafucked
모thafucker
모thafuckers
모thafuckin
모thafucking
모thafucks
모든 새
모든 인기있는
바퀴 슈커
배틀그라운드
뱅커
볼랙
빌어 먹을hitmotherfucker
뼈
사이버fucker
사이버fuckers
사이버감사
사이버후크
사이트맵
사이트맵.
쉬메일
스낵 바
스카크
스크랩
스펀지
시험대
신담
신담n
아들의 a-bitch
언어: 한국어
엄마
엄마5terb8
엄마fuckka
오르가즘
오줌싸기
옵션 정보
이름 *
인기 카테고리
인기있는
장바구니
잭 오프
잭오프
전체장편
제품 정보
제품정보
주 메뉴
주먹질
중년부인
채용 정보
채용공고
채용정보
카테고리
칼 머리
칼조키
큰 가슴
털이 많은
팟캐스트
펌웨어
페니스
페커
프로젝트
하드코어sex
한국어
핥기
핫 성별
회사 소개
アクティシクル
アコース
アスドル
アスフッカ
アスホール
アナル
アルス
インタビュー
インフォメーション
エジャキュレート
オーガスム
おばあさん
オルガスム
お問い合わせ
ガールフレンド
カウク
カムス
ギャング
ギャングバン
ギャングバング
クソ
クソヘッド
クマー
クムス
クムマー
クライストリ
クラス1t
クルミ
ゲイsexsex
コクサッカ
コクンチャー
ゴダメン
コック
コックキャッキング
コックサッカー
コックサック
コックス
コックスカ
コックスッカ
コックフェイス
コックヘッド
コックムンチャー
コック吸う
ゴッドダム
コンダム
コンドム
サイトマップ
サイバーfuck
サイバーfucked
サイバーファッカー
サイバーファッキング
サイバーフック
サディスト
シープラス
シーメール
シアリス
シェーグ
シェーディング
シッター
ジャークオフ
ジャーミー
シャガール
シャギン
ジャックオフ
シュロン
スカンク
スクリュー
スタッフ
スナッチ
スパク
スムート
スメグマ
セメン
ソリューション
タード
タイ5
ダイケ
ダイニング
ダック
ダムン
タワトヘッド
チンク
ツイート
つぶやき
ディルサ
ディルドー
ディルドス
ティワンク
テエズ
テッツ
デュチェ
トウランター
ドオッシュ
ドッギング
ドッグギン
トッサー
トピックス
トワット
ナイガス
ナジ
ナッツマック
ナムナッツ
ニガー
ニグ3r
ニグ4h
ニグガ
の55
ノビーズ
ノブ
ノブジョーキー
ノブジョキー
ノブヘッド
ノベット
ノベンド
パーティー
ハードコアsexsex
バイアッチ
バギーナ
パスシス
バスタード
パスワード
バッガー
パッシー
バッチュ
バッツ
バトール
パトリック
パブ
バム
ビーストリアル
ビアグラ
ピクチャー
ピッキング
ビットキャッシュ
ビットチェス
ビットチェボーイ
ビットチャー
ビットチャーズ
ピンピス
フーカー
プーク
ブーツ
ブーブ
ブーブス
ブームーブ
ブームーブス
プーン
ファグ
ファクシミリ
ファグス
ファゴット
ファッギング
ファック
ファッジパック
ファンニー
ファンニーfucker
ファンニーフラップ
フィードバック
フィストfuck
フィストfuckers
フィッシング
フィンガーfuck
フィンガーfucks
フィンガーファイヤー
フィンガーファッカー
フェッカー
フォーク
フクウク
フクカー
フクキン
プッシー
フューカー
ブラストス
フラッシャー
フランジ
プリカ
ふりがな
ブルシット
ブロージョブ
プロフィール
プロン
ベスト
ペッカー
ヘッドサス
ペニス
ベルン
ボールバック
ボールバッグ
ボールボール
ホーンシー
ホーンシーズ
ボセタ
ホットsex
ポップ
ボブ
ボヨラス
ボルロック
ボロク
マ5terb8
マスター・リベート
マスターb8
マスターバット*
マスターバット3
マスタービング
マスターブレーション
マスターリベート
マゾキスト
マフ
メニュー
モタクソファ
モタクソファー
モフ0
モフォ
ヤギ
ラボリア
リクルート
リタード
リファレンス
リミング
リムジャウ
ログイン
ワンカー
ワンキー
ワンク
专业
中国
主减法
主机b8
乌克
乌克维特
乌克金
乱七八糟
乱七八糟的
乳头
二极管
人気カテゴリー
他妈的
他妈的我
他妈的拳头
他妈的混蛋
低调
作为美元
你个混蛋
便便
做爱
公鸡
养狗
兽形
兽性
最佳状态
切开
划伤
划开
刺头
半径
单位
双倍径
双节
发声
发牢骚
发球
变形
变种人
口交时
叮当
可恶
吉兹
同性恋
同性恋者
吨数
吹箫
吼声
呕吐
唉哟
啄木鸟
嘘
嘘 +
嘘嘘
嘘声
坐标
垫子
堕落
堤坝
大便师
天杀的
头
头部
女同性恋
奶头
奶头5
奶妈
妇人
妈的
威尔
娘们
婊子们
宽度
射精术
射线
小便
小便便便便便时
小便小便
小时
尿裤子
屁眼
屁股
屁股整齐
屎东西
山羊队
已锁定
布鲁塞塔
帮派
库克
库克萨
库克门彻
库姆
库尼灵格斯
库林斯
废话
弯曲
性別
性别
恋物癖
息子-of-a-bitch
恶棍
愤怒
扇形叶片
手指他妈的
手淫
抖动
抢
拉屎了
拳头
拳头他妈的
拳头操
指fucked
指fucking
指头
掌握
掷掷器
摇摆
摩塔他妈的
摩尔福
撒尿
撒尿器
放尿
斯迈格马
旋转
旋钮
旋钮头
无
无名
无趣
日数a
普丝
杂种
杜彻
杜许
果实
枪托
标记
桨
欢呼
欲望
母fuck
母fucked
母fucker
母fuckers
母fuckin
母fucking
母fuckings
母fuckka
母fucks
沉积
波罗克
泰兹语name
流浪汉
测试
淫荡
混帐
灭鼠机
烂透了
烟花
热性
爱
犬 fucker
狗娘养的
狗语
猪头
猫咪
獣性
球囊
球头
电话
疯子
皮条客
皮肤
直肠
睾丸
矫形
硬核性行为
神秘的な被害を受けた
神经病
福尔
福尔克
积分
粪便
精液
纳吉
纳粹
累积射击
细小的叶片
绍乙.
缩写
网络他妈的
网络操
网络混蛋
网络福克
肛门
肥猪
胡说
脂肪マッサージ
臀部
色情制品
色情电影
花纹
荡妇
萨格
落ち着き
虐待狂
虐恋狂
虚无
蠢货
角最强
角质
该死的
调味料
质子
质量
贱人
贱货
贾宝玉
轨道5e
转数
软糖包装机
连环画
迟钝
迪尔多
迷恋
针叶
铃声
铜
键
键盘
长
闪烁
闲着
阴唇
阴囊
阴茎
阴蒂
阴道
阴间
阿斯福卡语name
零点3r
電子メール
電話sex
页:1
风扇
马夫
驴
驴肋架
骂人
骗局
骨头
高尔
高潮
高级
高级bat3
高级项目*
鸡
鸡头
鸡尾酒
鸡巴
鸡巴脸
鸡肉
鸡鸡
鹅
麻核
黄
黑头
黑帮
黑鬼
黑鬼们
齐巴
```

## Reserved Handles for Owner/Admin Allocation
These terms are also tracked in DB reserved-handle governance and should be blocked for regular users.

```text
about
account
accounts
admin
administrator
admins
agent
api
auth
billing
blog
brand
careers
cofounder
community-manager
communitymanager
company
compliance
contact
cookies
corporate
create
customer-support
customersupport
dev
developer
docs
documentation
employee
founder
helpdesk
helpsupport
imprint
invoice
jobs
legal
login
logout
mail
mailer
media
mod
moderator
mods
no-reply
noreply
oauth
official
operations
ops
owner
partner
partners
payments
postmaster
press
privacy
profile
profiles
refund
register
returns
root
secure
security
security-team
securityteam
service
servicedesk
settings
signin
signup
staff
status
statuspage
support
sysadmin
system
team
terms
travel_flow
travel-flow
travelflow
travelflowapp
travelplanner
trip
tripplanner
trips
trust
trust-safety
trustsafety
u
verification
verified
verified-team
webmaster
www
```

## Implementation Notes
1. Canonical comparison should be lowercase and trimmed.
2. Validation should run in DB trigger/RPC path and availability checks.
3. Frontend may mirror this list partially for immediate feedback, but backend remains authoritative.
4. Review this file during moderation policy updates and package version bumps.
5. Recommended future extension: store per-term categories in DB (`category`, `severity`, `source`) and combine those attributes with profile-report signals for semi-automatic recategorization workflows.
