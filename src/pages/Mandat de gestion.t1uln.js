import wixWindowFrontend from 'wix-window-frontend';

// Page Gestion locative — cartes du répéteur #repeater1.
// Chaque carte (#box17) a un titre (#text31) et un texte (#text32). Un seul texte ouvert
// à la fois : celui de la première carte au chargement, puis celui de la dernière carte
// survolée (ordinateur) ou touchée (téléphone, tablette : le survol n'y existe pas).
// Les iPad se présentent comme des ordinateurs : le toucher y déclenche le survol.

$w.onReady(function () {
    let openId;
    $w('#repeater1').forEachItem(($item, itemData, index) => {
        if (index === 0) openId = itemData._id;
        else $item('#text32').collapse();
    });

    const open = (event) => {
        const id = event.context.itemId;
        if (id === openId) return;
        $w('#repeater1').forEachItem(($item, itemData) => {
            if (itemData._id === id) $item('#text32').expand();
            else if (itemData._id === openId) $item('#text32').collapse();
        });
        openId = id;
    };

    if (wixWindowFrontend.formFactor === 'Desktop') $w('#box17').onMouseIn(open);
    else $w('#box17').onClick(open);
});
