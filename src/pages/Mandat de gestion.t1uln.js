import wixWindowFrontend from 'wix-window-frontend';

// Page Gestion locative — cartes du répéteur #repeater1.
// Chaque carte (#box17) a un titre (#text31) et un texte (#text32). Un seul texte ouvert
// à la fois : celui de la première carte au chargement, puis celui de la dernière carte
// survolée (ordinateur) ou touchée (téléphone, tablette : le survol n'y existe pas).
// Les iPad se présentent comme des ordinateurs : le toucher y déclenche le survol.
// L'ouverture en glissé, le fondu du texte et l'atténuation des titres des cartes fermées
// sont dans src/styles/global.css (classes « cartes », « carte », « carte--ouverte »…) :
// ce code ne fait que poser les classes.

$w.onReady(function () {
    let openId;
    $w('#repeater1').customClassList.add('cartes');
    $w('#repeater1').forEachItem(($item, itemData, index) => {
        $item('#box17').customClassList.add('carte');
        $item('#text31').customClassList.add('carte-titre');
        $item('#text32').customClassList.add('carte-texte');
        if (index === 0) {
            $item('#box17').customClassList.add('carte--ouverte');
            openId = itemData._id;
        }
    });

    const open = (event) => {
        const id = event.context.itemId;
        if (id === openId) return;
        $w('#repeater1').forEachItem(($item, itemData) => {
            if (itemData._id === id) $item('#box17').customClassList.add('carte--ouverte');
            else if (itemData._id === openId) $item('#box17').customClassList.remove('carte--ouverte');
        });
        openId = id;
    };

    if (wixWindowFrontend.formFactor === 'Desktop') $w('#box17').onMouseIn(open);
    else $w('#box17').onClick(open);
});
