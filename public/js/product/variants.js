
(function ($) {
    $.fn.bootstrapValidator.validators.uniqueVariant = {
        html5Attributes: {
            message: 'message',
            field: 'field',
            check_only_for: 'check_only_for'
        },
        validate: function (validator, $field, options) {
            var value = $field.val();
            if (variantsBeingEdited.length == 0) {
                return true;
            }
            for (var i = 0; i < variantsBeingEdited.length; i++) {
                if (variantsBeingEdited[i] !== selectedVariant && variantsBeingEdited[i].name.toLowerCase() === value.toLowerCase()) {
                    return false;
                }
            }
            return true;
        }
    }
}(window.jQuery));

function saveVariantToLocalModel() {
    if (!selectedVariant) {
        selectedVariant = {};
        variantsBeingEdited.push(selectedVariant);
    }
    selectedVariant.name = $('#variantName').val();
    selectedVariant.price = $('#variantPrice').val();
    selectedVariant.nameWithPrice = nameWithPrice(selectedVariant.name, selectedVariant.price);
    fillVariations(true);
    $('#variantModal').modal('hide');
    selectedVariant = null;
    renderOptionNav();
}

function addVariant() {
    $('#variantForm').data('bootstrapValidator').resetForm();
    $('#variantName').val("");
    $('#variantPrice').val("");
    $('#variantModal').modal();
    selectedVariant = null;
}

function fillVariations(refresh) {
    $variantSelect[0].selectize.clear();
    $variantSelect[0].selectize.clearOptions();
    $variantSelect[0].selectize.load(function (cb) {
        cb(variantsBeingEdited || []);
        if (variantsBeingEdited && variantsBeingEdited.length) {
            for (var i = 0; i < variantsBeingEdited.length; i++) {
                $variantSelect[0].selectize.addItem(variantsBeingEdited[i].name);
            }
        }
        if (refresh) {
            $variantSelect[0].selectize.refreshItems();
        }
    });
}

function setupVariants() {
    $('#deleteVariant').on('click', function () {
        if (selectedVariant) {
            variantsBeingEdited.splice($.inArray(selectedVariant, variantsBeingEdited), 1);
        }
    });
    $('#variantModal').on('shown.bs.modal', function () {
        $('#variantPrice').focus();
    });
    $("#variantPrice").money_field({});
    $('#variantForm').bootstrapValidator({
        live: 'enabled',
        feedbackIcons: {
            valid: 'glyphicon glyphicon-ok',
            invalid: 'glyphicon glyphicon-remove',
            validating: 'glyphicon glyphicon-refresh'
        },
        fields: {
            variantName: {
                validators: {
                    notEmpty: {
                        message: 'A name is required.'
                    },
                    uniqueVariant: {
                        message: 'The name of the variation must be unique.'
                    }
                }
            }
        }
    }).on('success.form.bv', function(e) {
        e.preventDefault();
        saveVariantToLocalModel();
    });
}