var dataSource, $categorySelect, $taxSelect, $modSelect, $variantSelect, $modelSelect, model;
var selectedProduct = null, selectedTax = null, selectedModifier = null, selectedModifierValue = null, selectedVariant = null;
var variantsBeingEdited = [], modifierValuesBeingEdited = [];


function nameWithPrice(n, p) {
    return n + " (" + accounting.formatMoney(p) + ")";
}

$(document).ready(function () {
    setupProductGrid();
    setupItemModal();
    setupTax();
    setupModifiers();
    setupVariants();

    $('#publish').on('click', function () {
        publishModel();
    });
    $('.help-block a').popover({container: document.body, html: true});
    $('#csvUploadButton').on('click', function () {
        $('#xlsInfo').hide();
        $('#csvInfo').show();
        $('#importModal').modal();
    });
    $('#xlsUploadButton').on('click', function () {
        $('#csvInfo').hide();
        $('#xlsInfo').show();
        $('#importModal').modal();
    });
});

