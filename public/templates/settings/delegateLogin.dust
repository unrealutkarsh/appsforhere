{>"layouts/master" /}

{<body}
    <br/>
    <div class="container theme-showcase" role="main">
        <!-- Main jumbotron for a primary marketing message or call to action -->
        <div class="jumbotron">
            <h1>Enter Password</h1>

            <p>
            The password should have been given to you by the person who provided this link.
            </p>
            {?showError}
            <p class="bg-danger" style="padding:15px;">
            Your password is incorrect.
            </p>
            {/showError}
            <form role="form" method="POST" action="/oauth/delegates/{id}/{uuid}">
                <input type="hidden" name="_csrf" value="{_csrf}"/>

                <div class="form-group">
                    <input type="password" class="form-control" id="password" name="password"
                    placeholder="Password">
                    </div>
                    <button type="submit" class="btn btn-primary">Submit</button>
                </form>
            </div>
        </div>
{/body}