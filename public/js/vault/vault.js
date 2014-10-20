$(function() {

    var validateDetails = function() {
        $('.cc-num').payment('formatCardNumber');
        $('.cc-exp').payment('formatCardExpiry');
        $('.cc-cvc').payment('formatCardCVC');
    }
    // this runs the above function every time stuff is entered into the card inputs
    $('.paymentInput').bind('change paste keyup', function() {
        validateDetails();
        $('.cc-type').val($.payment.cardType($('.cc-num').val()))
    });

});