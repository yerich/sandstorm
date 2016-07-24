/*
 */

var TemplateEngine = function(html, options) {
    var re = /<%([^%>]+)?%>/g, reExp = /(^( )?(if|for|else|switch|case|break|{|}))(.*)?/g, code = 'var r=[];\n', cursor = 0, match;
    var add = function(line, js) {
        js? (code += line.match(reExp) ? line + '\n' : 'r.push(' + line + ');\n') :
            (code += line != '' ? 'r.push("' + line.replace(/"/g, '\\"') + '");\n' : '');
        return add;
    }
    while(match = re.exec(html)) {
        add(html.slice(cursor, match.index))(match[1], true);
        cursor = match.index + match[0].length;
    }
    add(html.substr(cursor, html.length - cursor));
    code += 'return r.join("");';
    return new Function(code.replace(/[\r\t\n]/g, '')).apply(options);
}

var titleCache = {};
var searchForSongs = function(title) {
  if (titleCache[title]) {
    return $.Deferred().resolve(titleCache[title]);
  }
  var url = 'https://ws.audioscrobbler.com/2.0/?method=track.search&track=' + encodeURIComponent(title) +
    '&api_key=1bdc93c27fab0a35e9958a2e7c3e4a10&format=json';

  return $.getJSON(url).then(function(result) {
    titleCache[title] = result;
    return result;
  });
}

var addFormInput = function(options) {
  options = options || {};
  var template = '<div class="input-wrapper">' +
      '<input type="text" size="50" placeholder="Enter the name of <%if(this.another) {%>another<%}else{%>any<%}%> song..." />' +
      '<span />' +
    '</div>'
  var element = $(TemplateEngine(template, {
    another: options.another
  }));
  element.appendTo($('.form-wrapper'));
  if (options.focus) {
    $('.input-wrapper:last input').focus();
  }
}

var positionSuggestionBox = function(target) {
  $el = $('.suggestions');
  $el.show();
  var rect = target.getBoundingClientRect();
  $el.html('<span class="loading">Loading</span>');
  $('.suggestions-wrapper').css('top', rect.bottom);
}

var updateSuggestions = function(suggestions) {
  var template = '<ul><%for(var i in this.suggestions){%>' +
    '<li><%this.suggestions[i].artist%> - <%this.suggestions[i].name%>'+
    '<img src="<%this.suggestions[i].image[0]["#text"]%>"/></li><%}%>' +
    '</ul>';
  $el = $('.suggestions');
  $el.html($(TemplateEngine(template, {
    suggestions: suggestions.slice(0, 10)
  })));
}

$(function() {
  var suggestTimeout;
  var lastFocusedInput;

  var reset = function() {
    $('body').removeClass('darude');
    $('.progress').hide();
    $('.playlist').hide();
    $('.playlist-video').html('');
    $('.form-wrapper').show();
    $('.form-wrapper').html('');
    $('.submit-wrapper').show();
    addFormInput({
      focus: true
    });
  }

  var submitForm = function() {
    $('.form-wrapper, .submit-wrapper').fadeOut(190);
    setTimeout(function() { $('.progress').fadeIn(200); }, 200);
    setTimeout(function() { $('.progress').fadeOut(190);}, 1800);
    setTimeout(function() { showPlaylist(); }, 2000);
  }

  var resetVideo = function(e) {
    var embed = '<iframe width="560" height="100" src="http://www.youtube.com/embed/4ZXPP7qMSz4?&autoplay=1&rel=0&loop=1&modestbranding=1&controls=0&hd=1&autohide=1" frameborder="0" allowfullscreen></iframe>'
    $('.playlist-video').html('');
    $('.playlist-list .entry').removeClass('active');
    setTimeout(function() {
      $('.playlist-video').html(embed);
      if (e && e.target) {
        $(e.target).parents('.entry').addClass('active');
      }
      else {
        $('.playlist-list .entry:first-child').addClass('active');
      }
    }, 0);
  }

  var showPlaylist = function() {
    $('body').addClass('darude');
    $('.playlist').show();


    var template = '<%for(var i=0;i<100;i++){%><div class="entry"><div class="play-button">&#9658;</div>' +
      '<span class="title">Darude - Sandstorm</span><div class="bg"></div></div><%}%>';
    $('.playlist-list').html(TemplateEngine(template));
    resetVideo();


  }

  var formInputHandler = function(e) {
    if (e.key && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      var listItems = $('.suggestions li').toArray();
      var activeListItem = $('.suggestions li.active');
      var activeIndex = activeListItem ? listItems.indexOf(activeListItem[0]) : 0;

      var newActiveIndex;
      if (e.key === "ArrowDown") {
        newActiveIndex = Math.min(listItems.length - 1, activeIndex + 1);
      }
      else {
        newActiveIndex = Math.max(0, activeIndex - 1);
      }
      $('.suggestions li').removeClass('active');
      $(listItems[newActiveIndex]).addClass('active');
      return;
    }

    if (e.key === "Enter") {
      var activeListItem = $('.suggestions li.active')[0];
      if (activeListItem) {
        suggestionTakenHandler({
          target: activeListItem
        })
      }
      else {
        if ($('.form-wrapper input').filter(function(e) { return !!$(this).val() }).length) {
          submitForm();
        }
      }
      return;
    }

    if (e.key && !e.key.match(/^([0-9a-zA-Z]|Backspace)$/)) {
      return;
    }

    if (suggestTimeout) {
      clearTimeout(suggestTimeout);
    }
    var inputVal = $(e.target).val();

    if (lastFocusedInput !== e.target) {
      positionSuggestionBox(e.target);
    }
    lastFocusedInput = e.target;

    if (inputVal) {
      $('.suggestions').show();
      suggestTimeout = setTimeout(function() {
        searchForSongs(inputVal).then(function(data) {
          updateSuggestions(data.results.trackmatches.track);
        })
      }, 300);
      if (e.target === $('.input-wrapper:last input')[0]) {
        addFormInput({
          another: true
        });
      }
    }
    else {
      $('.suggestions').html('');
      $('.suggestions').hide();
      if (e.target === $('.input-wrapper input').slice(-2, -1)[0] && !$('.input-wrapper:last input').val()) {
        var x = $('.input-wrapper:last');
        x.fadeOut(200)

        setTimeout(function() {
          x.remove();
        }, 200);
      }
    }

    e.preventDefault();
  }

  $('.form-wrapper').on('keyup', 'input', formInputHandler);
  $('.playlist').on('click', '.play-button', resetVideo);
  $('.generate').on('click', submitForm);
  $('.generate-another').on('click', reset);
  //$('.form-wrapper').on('focus', 'input', formInputHandler);
  reset();

  var suggestionTakenHandler = function(e) {
    $(lastFocusedInput).val($(e.target).text());
    var currInputIndex = $('.input-wrapper input').toArray().indexOf(lastFocusedInput);
    $($('.input-wrapper input')[currInputIndex+1]).focus();
    $('.suggestions').html('');
    $('.suggestions').hide();
  }
  $('.suggestions').on('click', 'li', suggestionTakenHandler);
});
